import { sendWelcomeEmail } from "../emails/emailHandlers.js";
import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { ENV } from "../lib/env.js";
import cloudinary from "../lib/cloudinary.js";

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;

  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // check if emailis valid: regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "Email already exists" });

    // 123456 => $dnjasdkasj_?dmsakmk
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    if (newUser) {
      // before CR:
      // generateToken(newUser._id, res);
      // await newUser.save();

      // after CR:
      // Persist user first, then issue auth cookie
      const savedUser = await newUser.save();
      generateToken(savedUser._id, res);

      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
      });

      try {
        await sendWelcomeEmail(savedUser.email, savedUser.fullName, ENV.CLIENT_URL);
      } catch (error) {
        console.error("Failed to send welcome email:", error);
      }
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.log("Error in signup controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    // never tell the client which one is incorrect: password or email

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) return res.status(400).json({ message: "Invalid credentials" });

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (error) {
    console.error("Error in login controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = (_, res) => {
  res.cookie("jwt", "", { maxAge: 0 });
  res.status(200).json({ message: "Logged out successfully" });
};

export const updateProfile = async (req, res) => {
  try {
    console.log("Update profile request received");
    console.log("Request body keys:", Object.keys(req.body));
    console.log("Request user:", req.user ? req.user._id : "No user found");

    const { profilePic } = req.body;
    if (!profilePic) {
      console.log("No profile pic provided");
      return res.status(400).json({ message: "Profile pic is required" });
    }

    if (!req.user || !req.user._id) {
      console.log("No authenticated user found");
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userId = req.user._id;
    console.log("Updating profile for user:", userId);

    let profilePicUrl = profilePic; // Default to base64 if Cloudinary fails

    // Try to upload to Cloudinary if credentials are configured
    if (ENV.CLOUDINARY_CLOUD_NAME && ENV.CLOUDINARY_API_KEY && ENV.CLOUDINARY_API_SECRET &&
        ENV.CLOUDINARY_CLOUD_NAME !== 'your-cloudinary-cloud-name') {
      try {
        console.log("Uploading to Cloudinary...");
        const uploadResponse = await cloudinary.uploader.upload(profilePic, {
          resource_type: "auto",
        });
        console.log("Cloudinary upload successful:", uploadResponse.secure_url);
        profilePicUrl = uploadResponse.secure_url;
      } catch (cloudinaryError) {
        console.log("Cloudinary upload failed, using base64 image:", cloudinaryError.message);
        // Continue with base64 image if Cloudinary fails
      }
    } else {
      console.log("Cloudinary not configured, using base64 image");
    }

    console.log("Updating user in database...");
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: profilePicUrl },
      { new: true }
    );

    if (!updatedUser) {
      console.log("User not found in database");
      return res.status(404).json({ message: "User not found" });
    }

    console.log("Profile updated successfully");
    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("Error in update profile:", error.message);
    console.log("Full error:", error);
    console.log("Error stack:", error.stack);
    res.status(500).json({ message: "Internal server error" });
  }
};
