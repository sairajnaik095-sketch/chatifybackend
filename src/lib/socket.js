import { Server } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import Message from "../models/Message.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [ENV.CLIENT_URL],
    credentials: true,
  },
});

// apply authentication middleware to all socket connections
io.use(socketAuthMiddleware);

// we will use this function to check if the user is online or not
export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// this is for storig online users
const userSocketMap = {}; // {userId:socketId}

io.on("connection", (socket) => {
  console.log("A user connected", socket.user.fullName);

  const userId = socket.userId;
  userSocketMap[userId] = socket.id;

  // Mark all pending messages as delivered when user comes online
  Message.find({ receiverId: userId, status: "sent" }).then(async (messages) => {
    if (messages.length > 0) {
      await Message.updateMany(
        { receiverId: userId, status: "sent" },
        { status: "delivered", deliveredAt: new Date() }
      );

      // Emit status updates to senders who are online
      const senderIds = [...new Set(messages.map(msg => msg.senderId.toString()))];
      senderIds.forEach(senderId => {
        const senderSocketId = getReceiverSocketId(senderId);
        if (senderSocketId) {
          messages.forEach(msg => {
            if (msg.senderId.toString() === senderId) {
              io.to(senderSocketId).emit("messageStatusUpdate", {
                messageId: msg._id,
                status: "delivered",
              });
            }
          });
        }
      });
    }
  }).catch(error => console.log("Error updating message status on connect:", error));

  // io.emit() is used to send events to all connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // with socket.on we listen for events from clients
  socket.on("markMessagesAsSeen", async ({ senderId }) => {
    try {
      const userId = socket.userId;
      await Message.updateMany(
        { senderId, receiverId: userId, status: { $ne: "seen" } },
        { status: "seen", seenAt: new Date() }
      );

      // Emit status update to sender
      const senderSocketId = getReceiverSocketId(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit("messagesSeen", { receiverId: userId });
      }
    } catch (error) {
      console.log("Error marking messages as seen:", error);
    }
  });

  // Video call signaling events
  socket.on("call-request", ({ to, from }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("incoming-call", { from });
    }
  });

  socket.on("call-accepted", ({ to, from }) => {
    const callerSocketId = getReceiverSocketId(to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call-accepted", { from });
    }
  });

  socket.on("offer", ({ to, offer }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("offer", { offer, from: socket.userId });
    }
  });

  socket.on("answer", ({ to, answer }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("answer", { answer, from: socket.userId });
    }
  });

  socket.on("end-call", ({ to }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call-ended", { from: socket.userId });
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.user.fullName);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
