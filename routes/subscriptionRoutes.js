const express = require("express");

const router = express.Router();

const subscriptionControllers = require(
  "../controllers/subscriptionControllers"
);

const {
  protect,
  protectAdmin,
} = require("../middleware/authMiddleware");

const upload = require("../middleware/multer");


// Merchant routes
router.get(
  "/me",
  protect,
  subscriptionControllers.getMySubscription
);

router.get(
  "/bank-details",
  protect,
  subscriptionControllers.getBankDetails
);

router.post(
  "/free",
  protect,
  subscriptionControllers.activateFreePlan
);

router.post(
  "/receipt",
  protect,
  upload.single("receipt"),
  subscriptionControllers.submitManualPayment
);

router.post(
  "/cancel",
  protect,
  subscriptionControllers.cancelSubscription
);

// Administrator routes
router.get(
  "/admin/pending",
  protectAdmin,
  subscriptionControllers.getPendingPayments
);

router.get(
  "/admin/history",
  protectAdmin,
  subscriptionControllers.getPaymentHistory
);

router.get(
  "/admin/premium-subscribers",
  protectAdmin,
  subscriptionControllers.getPremiumSubscribers
);

router.get(
  "/admin/:id/receipt",
  protectAdmin,
  subscriptionControllers.streamPaymentReceipt
);

router.patch(
  "/admin/:id/approve",
  protectAdmin,
  subscriptionControllers.approvePayment
);

router.patch(
  "/admin/:id/reject",
  protectAdmin,
  subscriptionControllers.rejectPayment
);

module.exports = router;