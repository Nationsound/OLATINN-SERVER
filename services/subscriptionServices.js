const Subscription = require("../models/subscriptionSchema");

const getCurrentSubscription = async (ownerId) => {
  const now = new Date();

  const subscriptions = await Subscription.find({
    owner: ownerId,
    status: { $in: ["active", "trialing"] },
  })
    .populate("plan", "key name")
    .sort({ createdAt: -1 });

  return subscriptions.find((subscription) => {
    // Free plans have no expiry date.
    if (subscription.plan?.key === "free") {
      return true;
    }

    // Paid plans are valid only through their current period.
    return (
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd > now
    );
  }) || null;
};

const hasPendingManualPayment = async (ownerId) => {
  return Subscription.exists({
    owner: ownerId,
    status: "incomplete",
    paymentProvider: "manual",
    paymentSubmittedAt: { $ne: null },
  });
};

module.exports = {
  getCurrentSubscription,
  hasPendingManualPayment,
};