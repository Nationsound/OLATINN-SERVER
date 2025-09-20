const express = require("express");
const designCommentControllers = require("../controllers/designCommentControllers");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// ➤ Create a comment on a design
router.post("/:designId", protect, designCommentControllers.createComment);

// ➤ Get all comments for a design
router.get("/:designId", designCommentControllers.getComments);

// ➤ Like / Unlike a comment
router.patch("/like/:commentId", protect, designCommentControllers.toggleLike);

// ➤ Reply to a comment
router.post("/reply/:commentId", protect, designCommentControllers.addReply);

// ➤ Edit a comment
router.put("/:commentId", protect, designCommentControllers.editComment);

// ➤ Delete a comment
router.delete("/:commentId", protect, designCommentControllers.deleteComment);

module.exports = router;
