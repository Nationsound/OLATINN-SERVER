// models/chatSchema.js
const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    senderType: { type: String, enum: ["user", "admin"], required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);
