// import dotenv from "dotenv";
// dotenv.config({ path: "../.env" });
// console.log("Resend Key:", process.env.RESEND_API_KEY);

// import express from "express";
// import cookieParser from "cookie-parser";
// import path from "path";
// import cors from "cors";

// import authRoutes from "./routes/auth.route.js";
// import messageRoutes from "./routes/message.route.js";
// import groupRoutes from "./routes/group.route.js";
// import { connectDB } from "./lib/db.js";
// import { ENV } from "./lib/env.js";
// import { app, server } from "./lib/socket.js";

// const __dirname = path.resolve();

// const PORT = ENV.PORT || 3000;

// app.use(express.json({ limit: "10mb" })); // req.body
// app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));
// app.use(cookieParser());

// app.use("/api/auth", authRoutes);
// app.use("/api/messages", messageRoutes);
// app.use("/api/groups", groupRoutes);

// // make ready for deployment
// if (ENV.NODE_ENV === "production") {
//   app.use(express.static(path.join(__dirname, "../frontend/dist")));

//   app.get("*", (_, res) => {
//     res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
//   });
// }

// server.listen(PORT, () => {
//   console.log("Server running on port: " + PORT);
//   connectDB();
// });


// import dotenv from "dotenv";
// import express from "express";
// import cookieParser from "cookie-parser";
// import path from "path";
// import cors from "cors";

// // Load environment variables
// dotenv.config(); 

// import authRoutes from "./routes/auth.route.js";
// import messageRoutes from "./routes/message.route.js";
// import groupRoutes from "./routes/group.route.js";
// import { connectDB } from "./lib/db.js";
// import { ENV } from "./lib/env.js";
// import { app, server } from "./lib/socket.js";

// const __dirname = path.resolve();
// const PORT = ENV.PORT || 10000;

// // Middlewares
// app.use(express.json({ limit: "10mb" }));
// app.use(cors({ 
//   origin: ENV.CLIENT_URL, 
//   credentials: true 
// }));
// app.use(cookieParser());

// // API Routes
// app.use("/api/auth", authRoutes);
// app.use("/api/messages", messageRoutes);
// app.use("/api/groups", groupRoutes);

// // Deployment Logic
// if (process.env.NODE_ENV === "production") {
//   // Path: root -> frontend -> dist
//   const distPath = path.join(__dirname, "..", "frontend", "dist");

//   app.use(express.static(distPath));

//   app.get("*", (req, res) => {
//     res.sendFile(path.join(distPath, "index.html"));
//   });
// } else {
//   // Basic route for development mode
//   app.get("/", (req, res) => {
//     res.send("API is running in development mode...");
//   });
// }

// // Start Server
// server.listen(PORT, () => {
//   console.log(`Server running on port: ${PORT}`);
//   // Log the path to help debug if files aren't found
//   if (ENV.NODE_ENV === "production") {
//     console.log(`Serving static files from: ${path.join(__dirname, "..", "dist")}`);
//   }
//   connectDB();
// });


import dotenv from "dotenv";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

dotenv.config();

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import groupRoutes from "./routes/group.route.js";
import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";
import { app, server } from "./lib/socket.js";

const PORT = ENV.PORT || 10000;

app.use(express.json({ limit: "10mb" }));
app.use(
  cors({
    origin: ENV.CLIENT_URL,
    credentials: true,
  })
);
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

app.get("/", (req, res) => {
  res.json({ status: "API running" });
});

server.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`);
  connectDB();
});
