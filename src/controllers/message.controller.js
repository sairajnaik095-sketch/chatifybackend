import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.log("Error in getAllContacts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMessagesByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userToChatId } = req.params;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, audio } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!text && !image && !audio) {
      return res.status(400).json({ message: "Text, image, or audio is required." });
    }
    if (senderId.equals(receiverId)) {
      return res.status(400).json({ message: "Cannot send messages to yourself." });
    }
    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found." });
    }

    let imageUrl;
    if (image) {
      // Validate base64 image data
      if (!image.startsWith('data:image/')) {
        return res.status(400).json({ message: "Invalid image format. Image must be a valid base64 data URL." });
      }
      // Store base64 data directly
      imageUrl = image;
    }

    let audioUrl;
    if (audio) {
      // Validate base64 audio data
      if (!audio.startsWith('data:audio/')) {
        return res.status(400).json({ message: "Invalid audio format. Audio must be a valid base64 data URL." });
      }
      // Store base64 data directly
      audioUrl = audio;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      audio: audioUrl,
    });

    await newMessage.save();
    console.log("Message saved:", { id: newMessage._id, senderId, receiverId, hasImage: !!imageUrl, hasAudio: !!audioUrl });

    const receiverSocketId = getReceiverSocketId(receiverId);
    console.log("Receiver socket ID:", receiverSocketId, "for user:", receiverId);

    if (receiverSocketId) {
      // Receiver is online, mark as delivered
      newMessage.status = "delivered";
      newMessage.deliveredAt = new Date();
      await newMessage.save();

      console.log("Emitting newMessage to receiver:", receiverSocketId);
      io.to(receiverSocketId).emit("newMessage", newMessage);
    } else {
      console.log("Receiver is offline, message status remains 'sent'");
    }

    // Emit status update to sender
    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      console.log("Emitting messageStatusUpdate to sender:", senderSocketId);
      io.to(senderSocketId).emit("messageStatusUpdate", {
        messageId: newMessage._id,
        status: newMessage.status,
      });
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    // find all the messages where the logged-in user is either sender or receiver
    // Only include one-to-one messages, exclude group messages
    const messages = await Message.find({
      $or: [
        { senderId: loggedInUserId },
        { receiverId: loggedInUserId },
      ],
      groupId: { $exists: false } // Exclude group messages
    });

    const chatPartnerIds = [
      ...new Set(
        messages.map((msg) =>
          msg.senderId.toString() === loggedInUserId.toString()
            ? msg.receiverId.toString()
            : msg.senderId.toString()
        )
      ),
    ];

    const chatPartners = await User.find({
      _id: { $in: chatPartnerIds },
      fullName: { $exists: true, $ne: null, $ne: "" } // Ensure users have valid names
    }).select("-password");

    // Calculate unread counts for each partner
    const partnersWithUnread = await Promise.all(
      chatPartners.map(async (partner) => {
        const unreadCount = await Message.countDocuments({
          senderId: partner._id,
          receiverId: loggedInUserId,
          status: { $in: ["sent", "delivered"] },
        });
        return {
          ...partner.toObject(),
          unreadCount,
        };
      })
    );

    // Sort by last message time
    const sortedPartners = partnersWithUnread.sort((a, b) => {
      // Find the last message between logged in user and each partner
      const aMessages = messages.filter(msg =>
        (msg.senderId.toString() === a._id.toString() && msg.receiverId.toString() === loggedInUserId.toString()) ||
        (msg.receiverId.toString() === a._id.toString() && msg.senderId.toString() === loggedInUserId.toString())
      );
      const bMessages = messages.filter(msg =>
        (msg.senderId.toString() === b._id.toString() && msg.receiverId.toString() === loggedInUserId.toString()) ||
        (msg.receiverId.toString() === b._id.toString() && msg.senderId.toString() === loggedInUserId.toString())
      );

      const aLastMessage = aMessages.sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))[0];
      const bLastMessage = bMessages.sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))[0];

      return new Date(bLastMessage?.createdAt || 0) - new Date(aLastMessage?.createdAt || 0);
    });

    res.status(200).json(sortedPartners);
  } catch (error) {
    console.error("Error in getChatPartners: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if the user is the sender of the message
    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You can only delete your own messages" });
    }

    await Message.findByIdAndDelete(messageId);

    // Emit delete event to the receiver
    const receiverSocketId = getReceiverSocketId(message.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageDeleted", { messageId });
    }

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.log("Error in deleteMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

