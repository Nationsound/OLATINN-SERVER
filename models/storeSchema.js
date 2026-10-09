
const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "A store owner is required"],
      unique: true,
      index: true,
    },

    businessName: {
      type: String,
      required: [true, "Please provide your business name"],
      trim: true,
      maxlength: 100,
    },

    storeName: {
      type: String,
      required: [true, "Please provide your store name"],
      trim: true,
      maxlength: 80,
    },

    slug: {
      type: String,
      required: [true, "A store URL is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use lowercase letters, numbers, and single hyphens",
      ],
      maxlength: 60,
    },

    category: {
      type: String,
      required: [true, "Please select a store category"], 
      trim: true,
      maxlength: 60,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    logoUrl: {
      type: String,
      trim: true,
      default: "",
    },

    primaryColor: {
      type: String,
      default: "#000271",
      match: [/^#[0-9a-fA-F]{6}$/, "Enter a valid hex color"],
    },

    secondaryColor: {
      type: String,
      default: "#17acdd",
      match: [/^#[0-9a-fA-F]{6}$/, "Enter a valid hex color"],
    },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },

    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Store", storeSchema);