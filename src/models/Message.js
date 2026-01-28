// import mongoose from "mongoose";

// const messageSchema = new mongoose.Schema(
//   {
//     senderId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     receiverId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     text: {
//       type: String,
//       trim: true,
//       maxlength: 2000,
//     },
//     image: {
//       type: String,
//     },
//   },
//   { timestamps: true }
// );

// const Message = mongoose.model("Message", messageSchema);

// export default Message;

import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // Required only for one-to-one messages, optional for group messages
      required: function() {
        return !this.groupId;
      },
    },

    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      // Optional field for group messages
    },

    text: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    image: {
      type: String,
    },

    audio: {
      type: String,
    },

    // ✅ NEW FIELD (powers WhatsApp ticks)
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },

    // ✅ OPTIONAL (for future upgrades)
    deliveredAt: {
      type: Date,
    },

    seenAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
