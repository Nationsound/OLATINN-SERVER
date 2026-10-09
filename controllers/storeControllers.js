
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");
const Store = require("../models/storeSchema");


const getAuthenticatedUserId = (req) => {
  const userId = req.user?._id || req.user?.userId || req.user?.id;

  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return null;
  }

  return String(userId);
};

const slugify = (value) => {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
};

const handleDatabaseError = (res, error) => {
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];

    if (field === "owner") {
      return res.status(409).json({
        success: false,
        message: "You already have a store. Retrieve your existing store instead.",
      });
    }

    if (field === "slug") {
      return res.status(409).json({
        success: false,
        message: "That store URL is already taken. Please choose another.",
      });
    }
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Store API error:", error);

  return res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
};


// POST /olatinn/api/store-front
const createStore = async (req, res) => {
  try {
    const ownerId = getAuthenticatedUserId(req);

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Your session could not be verified. Please sign in again.",
      });
    }

    const {
      businessName,
      storeName,
      slug,
      category,
      description,
      logoUrl,
      primaryColor,
      secondaryColor,
    } = req.body;

    if (
      typeof businessName !== "string" ||
      !businessName.trim() ||
      typeof storeName !== "string" ||
      !storeName.trim() ||
      typeof category !== "string" ||
      !category.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Business name, store name, and category are required.",
      });
    }

    const existingStore = await Store.findOne({ owner: ownerId });

    if (existingStore) {
      return res.status(409).json({
        success: false,
        message: "You already have a store.",
        store: existingStore,
      });
    }

    const storeSlug = slugify(slug || storeName);

    if (!storeSlug) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid store name or URL.",
      });
    }

    const store = await Store.create({
      owner: ownerId,
      businessName: businessName.trim(),
      storeName: storeName.trim(),
      slug: storeSlug,
      category: category.trim(),
      description,
      logoUrl,
      primaryColor,
      secondaryColor,
    });

    return res.status(201).json({
      success: true,
      message: "Your store has been created successfully.",
      store,
    });
  } catch (error) {
    return handleDatabaseError(res, error);
  }
};

// Upload merchant store logo
const uploadStoreLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a logo image to upload.",
      });
    }

    // Get the authenticated user's MongoDB ID.
    const userId = req.user?._id || req.user?.userId || req.user?.id;

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please sign in again.",
      });
    }

    // Upload the selected image to Cloudinary.
    const uploadResponse = await cloudinary.uploader.upload(
      req.file.path,
      {
        folder: "olatinn-store-logos",
        resource_type: "image",
      }
    );

    // Return the URL so the frontend can include it when creating the store.
    return res.status(200).json({
      success: true,
      message: "Store logo uploaded successfully.",
      logoUrl: uploadResponse.secure_url,
    });
  } catch (error) {
    console.error("Store logo upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload store logo.",
    });
  }
};
// GET /olatinn/api/store-front/my-store
const getMyStore = async (req, res) => {
  try {
    const ownerId = getAuthenticatedUserId(req);

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Please sign in to access your store.",
      });
    }

    const store = await Store.findOne({ owner: ownerId });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "You haven't created a store yet.",
      });
    }

    return res.status(200).json({
      success: true,
      store,
    });
  } catch (error) {
    return handleDatabaseError(res, error);
  }
};

// PATCH /olatinn/api/store-front/my-store
const updateMyStore = async (req, res) => {
  try {
    const ownerId = getAuthenticatedUserId(req);

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Please sign in to update your store.",
      });
    }

    const allowedFields = [
      "businessName",
      "storeName",
      "slug",
      "category",
      "description",
      "logoUrl",
      "primaryColor",
      "secondaryColor",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (
      updates.businessName !== undefined &&
      (typeof updates.businessName !== "string" ||
        !updates.businessName.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Business name cannot be empty.",
      });
    }

    if (
      updates.storeName !== undefined &&
      (typeof updates.storeName !== "string" ||
        !updates.storeName.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Store name cannot be empty.",
      });
    }

    if (
      updates.category !== undefined &&
      (typeof updates.category !== "string" ||
        !updates.category.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Category cannot be empty.",
      });
    }

    if (updates.slug !== undefined) {
      updates.slug = slugify(updates.slug);

      if (!updates.slug) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid store URL.",
        });
      }
    }

    for (const field of ["businessName", "storeName", "category"]) {
      if (typeof updates[field] === "string") {
        updates[field] = updates[field].trim();
      }
    }

    const store = await Store.findOne({ owner: ownerId });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No store was found for your account.",
      });
    }

    for (const [field, value] of Object.entries(updates)) {
      store[field] = value;
    }

    await store.save();

    return res.status(200).json({
      success: true,
      message: "Your store has been updated successfully.",
      store,
    });
  } catch (error) {
    return handleDatabaseError(res, error);
  }
};

// GET /olatinn/api/store-front/public/:slug
const getPublicStore = async (req, res) => {
  try {
    const store = await Store.findOne({
      slug: String(req.params.slug).toLowerCase(),
      status: "published",
    }).select(
      "businessName storeName slug category description logoUrl primaryColor secondaryColor status publishedAt"
    );

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "This published store could not be found.",
      });
    }

    return res.status(200).json({
      success: true,
      store,
    });
  } catch (error) {
    return handleDatabaseError(res, error);
  }
};

// PATCH /olatinn/api/store-front/my-store/publish
const publishStore = async (req, res) => {
  try {
    const ownerId = getAuthenticatedUserId(req);

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Please sign in to publish your store.",
      });
    }

    const store = await Store.findOne({ owner: ownerId });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Create your store before publishing it.",
      });
    }

    if (
      !store.businessName?.trim() ||
      !store.storeName?.trim() ||
      !store.slug?.trim() ||
      !store.category?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Complete the required store details before publishing.",
      });
    }

    store.status = "published";
    store.publishedAt = store.publishedAt || new Date();

    await store.save();

    return res.status(200).json({
      success: true,
      message: "Your store is now published.",
      store,
      publicUrl: `/store/${store.slug}`,
    });
  } catch (error) {
    return handleDatabaseError(res, error);
  }
};

module.exports = {
  createStore,
  uploadStoreLogo,
  getMyStore,
  updateMyStore,
  getPublicStore,
  publishStore,
};