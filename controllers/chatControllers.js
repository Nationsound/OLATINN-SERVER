// controllers/chatControllers.js
const Chat = require("../models/chatSchema");

// Save a message to DB
const saveMessage = async (req, res) => {
  try {
    const { message, senderType } = req.body;
    if (!message || !senderType) {
      return res.status(400).json({ message: "Message and senderType are required" });
    }

    const chat = await Chat.create({ message, senderType });
    res.status(201).json({ message: "Message saved", chat });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all messages
const getMessages = async (req, res) => {
  try {
    const messages = await Chat.find().sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { saveMessage, getMessages };
