import mongoose from "mongoose";
import { ENV } from "./env.js";

export const connectDB = async () => {
  try {
    const mongoUri = ENV.MONGO_URI || "mongodb://localhost:27017/Chatify";
    const conn = await mongoose.connect(mongoUri);
    console.log("MONGODB CONNECTED:", conn.connection.host);
  } catch (error) {
    console.error("Error connection to MONGODB:", error);
    console.log("Make sure MongoDB is running locally on default port 27017");
    process.exit(1); // 1 status code means fail, 0 means success
  }
};
