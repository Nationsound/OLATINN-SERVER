
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Plan = require("../models/planSchema");

dotenv.config();

const plans = [
  {
    key: "free",
    name: "Free",
    description: "Start selling with your first online store.",
    isActive: true,
    prices: {
      currency: "NGN",
      monthly: 0,
      yearly: 0,
    },
    entitlements: {
      maxStores: 1,
      maxProductsPerStore: 3,
      themes: ["modern"],
      analyticsLevel: "basic",
      marketing: false,
    },
  },
  {
    key: "premium",
    name: "Premium",
    description: "Grow your business with multiple stores and premium tools.",
    isActive: true,
    prices: {
      currency: "NGN",
      monthly: null,
      yearly: null,
    },
    entitlements: {
      maxStores: 3,
      maxProductsPerStore: 25,
      themes: ["modern", "minimal", "boutique"],
      analyticsLevel: "advanced",
      marketing: true,
    },
  },
];

const seedPlans = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not configured.");
    }

    await mongoose.connect(process.env.MONGO_URI);

    for (const planData of plans) {
      const { key, ...fields } = planData;

      await Plan.findOneAndUpdate(
        { key },
        {
          $set: fields,
          $setOnInsert: { key },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );

      console.log(`Plan seeded: ${key}`);
    }

    console.log("Plan seeding completed.");
  } catch (error) {
    console.error("Plan seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedPlans();