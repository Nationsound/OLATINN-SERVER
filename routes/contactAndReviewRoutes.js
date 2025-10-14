const express = require("express");
const router = express.Router();
const contactAndReviewControllers = require("../controllers/contactAndReviewControllers");


// 📨 Contact form (public)
router.post("/contact", contactAndReviewControllers.submitContact);

// 🧾 Get all contact messages (admin only)
router.get("/contacts", contactAndReviewControllers.getContacts);

// 🌟 Get all reviews (public)
router.get("/reviews", contactAndReviewControllers.getReviews);

// 🔒 Create a new review (admin only)
router.post("/reviews", contactAndReviewControllers.createReview);
router.put("/reviews/:id", contactAndReviewControllers.updateReview);
router.delete("/reviews/:id", contactAndReviewControllers.deleteReview);

module.exports = router;
