const Plan = require("../models/planSchema");

const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({
      isActive: true,
    })
      .select(
        "key name description prices entitlements isActive"
      )
      .sort({ "prices.monthly": 1 })
      .lean();

    return res.status(200).json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error("Get plans error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve subscription plans.",
    });
  }
};

module.exports = {
  getPlans,
};