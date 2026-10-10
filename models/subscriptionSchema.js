
const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },

    status: {
      type: String,
      enum: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "expired",
        "incomplete",
      ],
      required: true,
      default: "incomplete",
      index: true,
    },

    billingInterval: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },

    trialStart: {
      type: Date,
      default: null,
    },

    trialEnd: {
      type: Date,
      default: null,
    },

    currentPeriodStart: {
      type: Date,
      default: null,
    },

    currentPeriodEnd: {
      type: Date,
      default: null,
    },

    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },

    canceledAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    paymentProvider: {
      type: String,
      enum: ["none", "paystack", "stripe"],
      default: "none",
    },

    providerCustomerId: {
      type: String,
      default: undefined,
    },

    providerSubscriptionId: {
      type: String,
      default: undefined,
    },

    priceAtPurchase: {
      type: Number,
      min: 0,
      default: null, 
    },

    currencyAtPurchase: {
      type: String,
      uppercase: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Efficiently retrieve a merchant's latest subscription.
subscriptionSchema.index({
  owner: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "Subscription",
  subscriptionSchema
);