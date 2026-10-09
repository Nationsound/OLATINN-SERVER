
const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: ["free", "premium"],
      lowercase: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    prices: {
      currency: {
        type: String,
        uppercase: true,
        default: "USD",
      },

      // Integer amounts in the smallest currency unit.
      // Keep null until real prices are configured.
      monthly: {
        type: Number,
        min: 0,
        default: null,
      },

      yearly: {
        type: Number,
        min: 0,
        default: null,
      },
    },

    entitlements: {
      maxStores: {
        type: Number,
        required: true,
        min: -1,
      },

      maxProductsPerStore: {
        type: Number,
        required: true,
        min: -1,
      },

      themes: {
        type: [String],
        enum: ["modern", "minimal", "boutique"],
        default: ["modern"],
      },

      analyticsLevel: {
        type: String,
        enum: ["none", "basic", "advanced"],
        default: "basic",
      },

      marketing: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Plan", planSchema);