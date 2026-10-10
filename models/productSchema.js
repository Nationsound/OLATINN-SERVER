const mongoose = require("mongoose");

const productImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    alt: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },

    category: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    brand: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    sku: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    compareAtPrice: {
      type: Number,
      default: null,
      min: 0,
    },

    stockQuantity: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Stock quantity must be a whole number.",
      },
    },

    trackInventory: {
      type: Boolean,
      default: true,
    },

    images: {
      type: [productImageSchema],
      default: [],
      validate: {
        validator: (images) => images.length <= 10,
        message: "A product can have a maximum of 10 images.",
      },
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    seo: {
      title: {
        type: String,
        default: "",
        trim: true,
        maxlength: 70,
      },
      description: {
        type: String,
        default: "",
        trim: true,
        maxlength: 200,
      },
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index(
  { store: 1, slug: 1 },
  { unique: true }
);

productSchema.index({
  owner: 1,
  store: 1,
  status: 1,
});

module.exports = mongoose.model("Product", productSchema);