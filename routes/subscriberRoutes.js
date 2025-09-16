const express = require("express");
const router = express.Router();
const subscriberControllers = require("../controllers/subscriberControllers");

// Create subscriber (with email confirmation)
router.post("/subscribe", subscriberControllers.createSubscriber);

// Get all subscribers
router.get("/", subscriberControllers.getAllSubscribers);

// Get single subscriber by ID
router.get("/:id", subscriberControllers.getSubscriberById);

// Update subscriber
router.put("/:id", subscriberControllers.updateSubscriber);

// Delete subscriber
router.delete("/:id", subscriberControllers.deleteSubscriber);

module.exports = router;
