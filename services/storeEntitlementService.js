
const Plan = require("../models/planSchema");
const Subscription = require("../models/subscriptionSchema");

const getMerchantEntitlements = async (ownerId) => {
  const now = new Date();

  const freePlan = await Plan.findOne({
    key: "free",
    isActive: true,
  });

  if (!freePlan) {
    throw new Error("The Free plan is not configured.");
  }

  const subscriptions = await Subscription.find({
    owner: ownerId,
    status: { $in: ["trialing", "active"] },
  })
    .sort({ createdAt: -1 })
    .populate("plan");

  const validSubscription = subscriptions.find((subscription) => {
    if (!subscription.plan || !subscription.plan.isActive) {
      return false;
    }

    if (
      subscription.status === "trialing" &&
      subscription.trialEnd &&
      subscription.trialEnd > now
    ) {
      return true;
    }

    if (
      subscription.status === "active" &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd > now
    ) {
      return true;
    }

    return false;
  });

  const plan = validSubscription
    ? validSubscription.plan
    : freePlan;

  return {
    plan,
    subscription: validSubscription || null,
    accessStatus: validSubscription
      ? validSubscription.status
      : "free",
    entitlements: plan.entitlements,
  };
};

module.exports = {
  getMerchantEntitlements,
};