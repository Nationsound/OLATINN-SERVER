// routes/chatRoutes.js
const express = require("express");
const router = express.Router();
const chatControllers = require("../controllers/chatControllers");
const { protect, protectAdmin } = require("../middleware/authMiddleware");

// Users save a message
router.post("/message", protect, chatControllers.saveMessage);

// Admin save a message
router.post("/admin-message", protectAdmin, chatControllers.saveMessage);

// Get all messages (Admin only)
router.get("/messages", protectAdmin, chatControllers.getMessages);

module.exports = router;
