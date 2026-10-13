const mongoose = require("mongoose");

const Plan = require("../models/planSchema");
const Subscription = require("../models/subscriptionSchema");

const cloudinary = require("../config/cloudinary");
const fs = require("fs/promises");

const {
  getCurrentSubscription,
  hasPendingManualPayment,
} = require("../services/subscriptionService");

const removeTemporaryFile = async (filePath) => {
  if (filePath) {
    await fs.unlink(filePath).catch(() => {});
  }
};

const uploadReceiptToCloudinary = async (filePath) => {
  return cloudinary.uploader.upload(filePath, {
    folder: "olatinn/store-front/payment-receipts",
    resource_type: "auto",
    type: "authenticated",
  });
};


const getUserId = (req) => req.user?._id;

const getAdminId = (req) => req.admin?._id;

const addBillingPeriod = (date, interval) => {
  const end = new Date(date);

  if (interval === "yearly") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }

  return end;
};

const getConfiguredBankDetails = () => ({
  accountName: process.env.STORE_FRONT_BANK_ACCOUNT_NAME || "",
  bankName: process.env.STORE_FRONT_BANK_NAME || "",
  accountNumber: process.env.STORE_FRONT_BANK_ACCOUNT_NUMBER || "",
});

const getPrice = (plan, interval) => {
  if (interval !== "monthly" && interval !== "yearly") {
    return null;
  }

  const price = plan.prices?.[interval];

  if (!Number.isFinite(price) || price < 0) {
    return null;
  }

  return price;
};

const getMySubscription = async (req, res) => {
  try {
    const ownerId = getUserId(req);

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const subscription = await Subscription.findOne({
      owner: ownerId,
    })
      .sort({ createdAt: -1 })
      .populate("plan", "key name description prices entitlements")
      .select(
  "-paymentReceiptPath -paymentReceiptUrl -paymentReceiptPublicId"
)

    return res.status(200).json({
      success: true,
      subscription,
    });
  } catch (error) {
    console.error("Get subscription error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your subscription.",
    });
  }
};

const activateFreePlan = async (req, res) => {
  try {
    const ownerId = getUserId(req);

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const freePlan = await Plan.findOne({
      key: "free",
      isActive: true,
    });

    if (!freePlan) {
      return res.status(404).json({
        success: false,
        message: "The Free plan is currently unavailable.",
      });
    }

    // 1. Check whether the user already has an active or trialing subscription.
    const currentSubscription = await getCurrentSubscription(ownerId);

    if (currentSubscription) {
      return res.status(409).json({
        success: false,
        message: "You already have an active subscription.",
        subscription: currentSubscription,
      });
    }

    // 2. Check whether a Premium manual payment is awaiting review.
    const pendingPayment = await hasPendingManualPayment(ownerId);

    if (pendingPayment) {
      return res.status(409).json({
        success: false,
        message:
          "You have a payment awaiting review. Please wait for the review before activating the Free plan.",
      });
    }

    const now = new Date();

    // Find the user's most recent active or trialing subscription.
    const existingSubscriptions = await Subscription.find({
      owner: ownerId,
      status: { $in: ["active", "trialing"] },
    })
      .sort({ createdAt: -1 })
      .populate("plan", "key");

    const activeOrTrialingSubscription = existingSubscriptions.find(
      (subscription) => {
        if (!subscription.plan) return false;

        // Free subscriptions do not have an expiry date.
        if (subscription.plan.key === "free") {
          return true;
        }

        return (
          subscription.currentPeriodEnd &&
          subscription.currentPeriodEnd > now
        );
      }
    );

    if (activeOrTrialingSubscription?.plan?.key === "free") {
      return res.status(200).json({
        success: true,
        message: "You are already using the Free plan.",
        subscription: activeOrTrialingSubscription,
      });
    }

    if (activeOrTrialingSubscription) {
      return res.status(409).json({
        success: false,
        message:
          "You already have an active paid subscription. Manage it before activating the Free plan.",
      });
    }

    const manualPaymentPending = await Subscription.findOne({
      owner: ownerId,
      status: "incomplete",
      paymentProvider: "manual",
      paymentSubmittedAt: { $ne: null },
    });

    if (manualPaymentPending) {
      return res.status(409).json({
        success: false,
        message:
          "You have a payment awaiting review. Please wait for the administrator's decision.",
      });
    }

    const subscription = await Subscription.create({
      owner: ownerId,
      plan: freePlan._id,
      status: "active",
      billingInterval: "monthly",
      currentPeriodStart: now,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      endedAt: null,
      paymentProvider: "none",
      priceAtPurchase: 0,
      currencyAtPurchase: "NGN",
    });

    return res.status(201).json({
      success: true,
      message: "Your Free plan is now active.",
      subscription,
    });
  } catch (error) {
    console.error("Activate Free plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to activate the Free plan.",
    });
  }
};

const submitManualPayment = async (req, res) => {
  let cloudinaryReceipt = null;

  try {
    const ownerId = getUserId(req);

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!req.file?.path) {
      return res.status(400).json({
        success: false,
        message: "Please upload your payment receipt.",
      });
    }

    const { planKey, billingInterval, paymentReference } = req.body;

    if (
      typeof planKey !== "string" ||
      planKey.toLowerCase() !== "premium"
    ) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid paid plan.",
      });
    }

    if (!["monthly", "yearly"].includes(billingInterval)) {
      return res.status(400).json({
        success: false,
        message: "Select monthly or yearly billing.",
      });
    }

    if (
      typeof paymentReference !== "string" ||
      !paymentReference.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide your bank transfer reference.",
      });
    }

    const existing = await Subscription.findOne({
      owner: ownerId,
      status: { $in: ["active", "trialing"] },
      $or: [
        { currentPeriodEnd: { $gt: new Date() } },
        { currentPeriodEnd: null },
      ],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "You already have an active subscription. Manage it before purchasing another plan.",
      });
    }

    const pending = await Subscription.findOne({
      owner: ownerId,
      status: "incomplete",
      paymentProvider: "manual",
      paymentSubmittedAt: { $ne: null },
    });

    if (pending) {
      return res.status(409).json({
        success: false,
        message: "You already have a payment awaiting review.",
      });
    }

    const plan = await Plan.findOne({
      key: "premium",
      isActive: true,
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "The selected plan is unavailable.",
      });
    }

    const price = getPrice(plan, billingInterval);

    if (price === null || price <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "A valid price has not been configured for this plan and billing interval.",
      });
    }

    if (plan.prices?.currency !== "NGN") {
      return res.status(400).json({
        success: false,
        message:
          "This subscription is not configured for NGN payments.",
      });
    }

    // Upload the receipt directly to Cloudinary.
    cloudinaryReceipt = await uploadReceiptToCloudinary(req.file.path);

    const subscription = await Subscription.create({
      owner: ownerId,
      plan: plan._id,
      status: "incomplete",
      billingInterval,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      paymentProvider: "manual",
      priceAtPurchase: price,
      currencyAtPurchase: "NGN",

      paymentReceiptUrl: cloudinaryReceipt.secure_url,
      paymentReceiptPublicId: cloudinaryReceipt.public_id,

      paymentReference: paymentReference.trim(),
      paymentSubmittedAt: new Date(),

      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
    });

    return res.status(201).json({
      success: true,
      message:
        "Payment receipt submitted. Your subscription will activate after administrator approval.",
      subscription: {
        _id: subscription._id,
        status: subscription.status,
        billingInterval: subscription.billingInterval,
        priceAtPurchase: subscription.priceAtPurchase,
        currencyAtPurchase: subscription.currencyAtPurchase,
        paymentReference: subscription.paymentReference,
        paymentSubmittedAt: subscription.paymentSubmittedAt,
      },
    });
  } catch (error) {
    // If the database operation fails after upload, remove the orphaned asset.
    if (cloudinaryReceipt?.public_id) {
      await cloudinary.uploader
        .destroy(cloudinaryReceipt.public_id, {
          resource_type: cloudinaryReceipt.resource_type || "image",
          type: "authenticated",
        })
        .catch((cleanupError) => {
          console.error("Cloudinary cleanup error:", cleanupError);
        });
    }

    console.error("Submit payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to submit your payment receipt.",
    });
  } finally {
    await removeTemporaryFile(req.file?.path);
  }
};


const cancelSubscription = async (req, res) => {
  try {
    const ownerId = getUserId(req);

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const subscription = await Subscription.findOne({
      owner: ownerId,
      status: { $in: ["active", "trialing"] },
    })
      .populate("plan", "key name")
      .sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No active subscription was found.",
      });
    }

    const now = new Date();

    // Free plans have no paid billing period to cancel.
    if (subscription.plan?.key === "free") {
      return res.status(400).json({
        success: false,
        message:
          "Your Free plan has no renewal to cancel. You can continue using it or select another plan.",
      });
    }

    if (
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd > now
    ) {
      if (subscription.cancelAtPeriodEnd) {
        return res.status(200).json({
          success: true,
          message:
            "Your subscription is already scheduled for cancellation.",
          subscription,
        });
      }

      subscription.cancelAtPeriodEnd = true;
      subscription.canceledAt = now;

      await subscription.save();

      return res.status(200).json({
        success: true,
        message:
          "Cancellation scheduled. Your paid access will remain available until the current billing period ends.",
        subscription,
      });
    }

    // The paid period has already ended.
    subscription.status = "expired";
    subscription.cancelAtPeriodEnd = false;
    subscription.endedAt = now;

    await subscription.save();

    return res.status(200).json({
      success: true,
      message: "Your paid subscription has expired.",
      subscription,
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to cancel your subscription.",
    });
  }
};

const getPendingPayments = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({
      status: "incomplete",
      paymentProvider: "manual",
      paymentSubmittedAt: { $ne: null },
    })
      .populate("owner", "fullName email")
      .populate("plan", "key name")
      .select(
  "-paymentReceiptPath -paymentReceiptUrl -paymentReceiptPublicId"
)
      .sort({ paymentSubmittedAt: 1 });

    return res.status(200).json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    console.error("Pending payments error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve pending payments.",
    });
  }
};

const streamPaymentReceipt = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription ID.",
      });
    }

    const subscription = await Subscription.findOne({
      _id: req.params.id,
      paymentProvider: "manual",
      paymentSubmittedAt: { $ne: null },
    }).select(
      "paymentReceiptPublicId paymentReceiptUrl paymentSubmittedAt"
    );

    if (!subscription?.paymentReceiptPublicId) {
      return res.status(404).json({
        success: false,
        message: "Payment receipt not found.",
      });
    }

    const signedUrl = cloudinary.url(
      subscription.paymentReceiptPublicId,
      {
        secure: true,
        sign_url: true,
        type: "authenticated",
        resource_type: "image",
        attachment: false,
      }
    );

    return res.status(200).json({
      success: true,
      receiptUrl: signedUrl,
    });
  } catch (error) {
    console.error("Retrieve receipt error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve the payment receipt.",
    });
  }
};

const approvePayment = async (req, res) => {
  try {
    const adminId = getAdminId(req);

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Administrator authentication required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription ID.",
      });
    }

    const subscription = await Subscription.findOne({
      _id: req.params.id,
      status: "incomplete",
      paymentProvider: "manual",
      paymentSubmittedAt: { $ne: null },
    }).populate("plan");

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message:
          "Pending payment not found. It may already have been reviewed.",
      });
    }

    const existingActive = await Subscription.findOne({
      owner: subscription.owner,
      status: "active",
      currentPeriodEnd: { $gt: new Date() },
      _id: { $ne: subscription._id },
    });

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message:
          "This merchant already has an active subscription. Resolve the existing subscription before approving this payment.",
      });
    }

    const now = new Date();

    subscription.status = "active";
    subscription.currentPeriodStart = now;
    subscription.currentPeriodEnd = addBillingPeriod(
      now,
      subscription.billingInterval
    );
    subscription.reviewedBy = adminId;
    subscription.reviewedAt = now;
    subscription.rejectionReason = null;

    await subscription.save();

    return res.status(200).json({
      success: true,
      message: "Payment approved and subscription activated.",
      subscription,
    });
  } catch (error) {
    console.error("Approve payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to approve this payment.",
    });
  }
};

const rejectPayment = async (req, res) => {
  try {
    const adminId = getAdminId(req);

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Administrator authentication required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription ID.",
      });
    }

    const reason =
      typeof req.body.reason === "string"
        ? req.body.reason.trim()
        : "";

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Please provide a reason for rejecting the payment.",
      });
    }

    const subscription = await Subscription.findOne({
      _id: req.params.id,
      status: "incomplete",
      paymentProvider: "manual",
      paymentSubmittedAt: { $ne: null },
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Pending payment not found.",
      });
    }

    subscription.reviewedBy = adminId;
    subscription.reviewedAt = new Date();
    subscription.rejectionReason = reason;

    // Keep it incomplete, but clear paymentSubmittedAt so the merchant
    // can submit a replacement receipt. This also frees the pending slot.
    subscription.paymentSubmittedAt = null;

    await subscription.save();

    return res.status(200).json({
      success: true,
      message:
        "Payment rejected. The merchant may submit a corrected receipt.",
      subscription: {
        _id: subscription._id,
        status: subscription.status,
        rejectionReason: subscription.rejectionReason,
      },
    });
  } catch (error) {
    console.error("Reject payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to reject this payment.",
    });
  }
};

module.exports = {
  getMySubscription,
  activateFreePlan,
  submitManualPayment,
  cancelSubscription,
  getPendingPayments,
  streamPaymentReceipt,
  approvePayment,
  rejectPayment,
  getConfiguredBankDetails,
};