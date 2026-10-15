const mongoose = require("mongoose");

const Plan = require("../models/planSchema");
const Subscription = require("../models/subscriptionSchema");
const user = require("../models/authScema");

const cloudinary = require("../config/cloudinary");
const fs = require("fs/promises");
const trsnsporter = require("../config/mail.js");

const {
  getCurrentSubscription,
  hasPendingManualPayment,
} = require("../services/subscriptionServices"); 


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

const getBankDetails = async (req, res) => {
  try {
    const ownerId = getUserId(req);

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    return res.status(200).json({
      success: true,
      bankDetails: getConfiguredBankDetails(),
    });
  } catch (error) {
    console.error("Get bank details error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve bank details.",
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


const sendSubscriptionActivationEmail = async ({
  email,
  name,
  planName,
  billingInterval,
  amount,
  currency,
  currentPeriodStart,
  currentPeriodEnd,
}) => {
  if (!email) {
    console.warn(
      "Subscription activation email skipped: no recipient email."
    );

    return;
  }

  const formattedAmount = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 2,
  }).format(Number(amount || 0) / 100);

  const formattedStart = new Date(
    currentPeriodStart
  ).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const formattedEnd = new Date(
    currentPeriodEnd
  ).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const intervalLabel =
    billingInterval === "yearly" ? "Yearly" : "Monthly";

  const mailOptions = {
    from: `"Olatinn" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Your Olatinn ${planName} subscription is active`,
    text: `
Hello ${name || "there"},

Your Olatinn Store Front subscription has been successfully approved and activated.

Plan: ${planName}
Billing: ${intervalLabel}
Amount: ${formattedAmount}

Subscription period:
${formattedStart} to ${formattedEnd}

Your Premium Store Front benefits are now active.

Thank you for choosing Olatinn.

Olatinn
    `.trim(),

    html: `
      <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:620px;margin:0 auto;padding:40px 20px;">
          
          <div style="background:#000271;border-radius:18px 18px 0 0;padding:30px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;">
              Olatinn
            </h1>

            <p style="margin:8px 0 0;color:#bfefff;font-size:14px;">
              Store Front
            </p>
          </div>

          <div style="background:#ffffff;padding:35px 30px;border-radius:0 0 18px 18px;">
            
            <h2 style="margin:0 0 15px;color:#000271;font-size:24px;">
              Subscription Activated
            </h2>

            <p style="color:#475569;font-size:15px;line-height:1.7;">
              Hello ${name || "there"},
            </p>

            <p style="color:#475569;font-size:15px;line-height:1.7;">
              Your Olatinn Store Front subscription has been
              successfully approved and activated.
            </p>

            <div style="margin:25px 0;padding:22px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
              
              <p style="margin:0 0 10px;color:#64748b;font-size:12px;text-transform:uppercase;">
                Subscription
              </p>

              <p style="margin:0 0 8px;color:#000271;font-size:21px;font-weight:bold;">
                ${planName}
              </p>

              <p style="margin:6px 0;color:#475569;font-size:14px;">
                <strong>Billing:</strong> ${intervalLabel}
              </p>

              <p style="margin:6px 0;color:#475569;font-size:14px;">
                <strong>Amount:</strong> ${formattedAmount}
              </p>

              <p style="margin:6px 0;color:#475569;font-size:14px;">
                <strong>Start:</strong> ${formattedStart}
              </p>

              <p style="margin:6px 0;color:#475569;font-size:14px;">
                <strong>Expiry:</strong> ${formattedEnd}
              </p>

            </div>

            <div style="margin:25px 0;padding:16px;border-left:4px solid #17acdd;background:#effcff;">
              <p style="margin:0;color:#334155;font-size:14px;line-height:1.6;">
                Your Premium Store Front benefits are now active.
              </p>
            </div>

            <p style="color:#475569;font-size:15px;line-height:1.7;">
              Thank you for choosing Olatinn.
            </p>

            <p style="margin-top:30px;color:#64748b;font-size:13px;">
              Olatinn Store Front
            </p>

          </div>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

// ========================================
// Get pending manual payments
// ========================================

// const getPendingPayments = async (req, res) => {
//   try {
//     const adminId = getAdminId(req);

//     if (!adminId) {
//       return res.status(401).json({
//         success: false,
//         message: "Administrator authentication required.",
//       });
//     }

//     const pendingPayments = await Subscription.find({
//       status: "incomplete",
//       paymentProvider: "manual",
//       paymentSubmittedAt: { $ne: null },
//     })
//       .populate("owner", "email fullName name")
//       .populate("plan", "name key prices")
//       .sort({ paymentSubmittedAt: -1 });

//     return res.status(200).json({
//       success: true,
//       count: pendingPayments.length,
//       payments: pendingPayments,
//     });
//   } catch (error) {
//     console.error("Get pending payments error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Unable to retrieve pending payments.",
//     });
//   }
// };


// ========================================
// Get payment review history
// Approved + Rejected payments
// ========================================

const getPaymentHistory = async (req, res) => {
  try {
    const adminId = getAdminId(req);

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Administrator authentication required.",
      });
    }

    const payments = await Subscription.find({
      paymentProvider: "manual",
      reviewedAt: { $ne: null },
      status: {
        $in: ["active", "incomplete", "canceled", "ended"],
      },
    })
      .populate("owner", "email fullName name")
      .populate("plan", "name key prices")
      .populate("reviewedBy", "email fullName name")
      .sort({ reviewedAt: -1 });

    return res.status(200).json({
      success: true,
      count: payments.length,
      payments,
    });
  } catch (error) {
    console.error("Get payment history error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve payment history.",
    });
  }
};


// ========================================
// Get Premium subscribers
// Active + Inactive
// ========================================

const getPremiumSubscribers = async (req, res) => {
  try {
    const adminId = getAdminId(req);

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Administrator authentication required.",
      });
    }

    const premiumSubscribers = await Subscription.find({
      plan: {
        $exists: true,
        $ne: null,
      },
    })
      .populate("owner", "email fullName name")
      .populate("plan", "name key prices")
      .populate("reviewedBy", "email fullName name")
      .sort({ currentPeriodEnd: -1 });

    return res.status(200).json({
      success: true,
      count: premiumSubscribers.length,
      subscribers: premiumSubscribers,
    });
  } catch (error) {
    console.error("Get Premium subscribers error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve Premium subscribers.",
    });
  }
};

const getPaymentReceipt = streamPaymentReceipt;

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

// ========================================
// Send subscription activation email
// ========================================

try {
  const owner = await User.findById(subscription.owner).select(
    "email fullName name"
  );

  if (owner?.email) {
    await sendSubscriptionActivationEmail({
      email: owner.email,
      name: owner.fullName || owner.name || "there",
      planName: subscription.plan?.name || "Premium",
      billingInterval: subscription.billingInterval,
      amount: subscription.priceAtPurchase,
      currency: subscription.currencyAtPurchase,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
    });
  } else {
    console.warn(
      "Subscription activated, but owner email was not found."
    );
  }
} catch (emailError) {
  console.error(
    "Subscription activated, but activation email failed:",
    emailError
  );
}

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
  getBankDetails,
  activateFreePlan,
  submitManualPayment,
  cancelSubscription,
  getPendingPayments,
  streamPaymentReceipt,
  sendSubscriptionActivationEmail,
  getPaymentReceipt,
  getPaymentHistory,
  getPremiumSubscribers,
  approvePayment,
  rejectPayment,
  getConfiguredBankDetails,
};