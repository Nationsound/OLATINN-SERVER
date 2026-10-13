const express = require("express");

const router = express.Router();

const subscriptionControllers = require(
  "../controllers/subscriptionController"
);

const {
  protect,
  protectAdmin,
} = require("../middleware/authMiddleware");

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
  subscriptionControllers.uploadPaymentReceipt,
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
  "/admin/:id/receipt",
  protectAdmin,
  subscriptionControllers.getPaymentReceipt
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