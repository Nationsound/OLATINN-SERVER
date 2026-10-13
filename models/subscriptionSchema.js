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
      required: true,
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
      enum: ["none", "paystack", "stripe", "manual"],
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

    // Private receipt path. Do not expose this as a public static file.
    paymentReceiptPath: {
      type: String,
      default: null,
    },

    paymentReference: {
      type: String,
      trim: true,
      default: null,
    },

    paymentSubmittedAt: {
      type: Date,
      default: null,
    },

    paymentReceiptUrl: {
  type: String,
  default: null,
},

paymentReceiptPublicId: {
  type: String,
  default: null,
},

paymentReceiptResourceType: {
  type: String,
  enum: ["image", "raw", "video"],
  default: null,
},

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

subscriptionSchema.index({
  owner: 1,
  createdAt: -1,
});

subscriptionSchema.index({
  status: 1,
  paymentSubmittedAt: -1,
});

// Only one active or trialing subscription per user.
subscriptionSchema.index(
  { owner: 1 },
  {
    unique: true,
    name: "one_active_subscription_per_owner",
    partialFilterExpression: {
      status: { $in: ["active", "trialing"] },
    },
  }
);

module.exports = mongoose.model(
  "Subscription",
  subscriptionSchema
);