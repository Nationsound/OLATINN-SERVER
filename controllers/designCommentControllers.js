const DesignComment = require("../models/designCommentSchema");

// Create a comment
const createComment = async (req, res) => {
  try {
    const { text } = req.body;
    const { designId } = req.params;

    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }

    const newComment = await DesignComment.create({
      text,
      designId,
      user: req.user._id,
    });

    // Populate only fullName
    const populatedComment = await newComment.populate("user", "fullName");

    res.status(201).json(populatedComment);
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ message: "Failed to create comment" });
  }
};

// Get all comments for a design
const getComments = async (req, res) => {
  try {
    const { designId } = req.params;
    const comments = await DesignComment.find({ designId })
      .populate("user", "fullName")       // top-level comment
      .populate("replies.user", "fullName") // replies
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// controllers/designCommentControllers.js


const toggleLike = async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!commentId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    const comment = await DesignComment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.likes = (comment.likes || 0) + 1;
    await comment.save();

    res.status(200).json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};


module.exports = { toggleLike };





// Add a reply
const addReply = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { text } = req.body;

    const comment = await DesignComment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.replies.push({ user: req.user._id, text });
    await comment.save();

    res.json(comment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Edit comment
const editComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { text } = req.body;

    const comment = await DesignComment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    comment.text = text;
    await comment.save();

    res.json(comment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete comment
const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const comment = await DesignComment.findById(commentId);

    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await comment.deleteOne();
    res.json({ message: "Comment deleted" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  createComment,
  getComments,
  toggleLike,
  addReply,
  editComment,
  deleteComment,
};
