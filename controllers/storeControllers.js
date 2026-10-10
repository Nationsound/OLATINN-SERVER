
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");
const Store = require("../models/storeSchema");
const {
  getMerchantEntitlements,
} = require("../services/storeEntitlementService");


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
                message:
                    "Your session could not be verified. Please sign in again.",
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
            theme,
        } = req.body;

        // Validate required fields.
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
                message:
                    "Business name, store name, and category are required.",
            });
        }

        // Validate optional text fields.
        if (
            description !== undefined &&
            typeof description !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Description must be text.",
            });
        }

        if (
            logoUrl !== undefined &&
            typeof logoUrl !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Logo URL must be text.",
            });
        }

        // Validate the requested theme.
        const validThemes = ["modern", "minimal", "boutique"];
        const selectedTheme = theme || "modern";

        if (
            typeof selectedTheme !== "string" ||
            !validThemes.includes(selectedTheme)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid store theme.",
            });
        }

        // Validate colors.
        const selectedPrimaryColor = primaryColor || "#000271";
        const selectedSecondaryColor = secondaryColor || "#17acdd";

        const validHexColor = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

        if (
            typeof selectedPrimaryColor !== "string" ||
            !validHexColor.test(selectedPrimaryColor) ||
            typeof selectedSecondaryColor !== "string" ||
            !validHexColor.test(selectedSecondaryColor)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Primary and secondary colors must be valid hexadecimal colors.",
            });
        }

        // Get the merchant's effective plan and entitlements.
        const account = await getMerchantEntitlements(ownerId);

        const plan = account?.plan;
        const entitlements = account?.entitlements;

        if (
            !plan ||
            !entitlements ||
            !Array.isArray(entitlements.themes) ||
            typeof entitlements.maxStores !== "number"
        ) {
            console.error(
                "Invalid merchant entitlement response:",
                account
            );

            return res.status(500).json({
                success: false,
                message:
                    "We could not verify your store plan. Please try again later.",
            });
        }

        // Enforce theme entitlement.
        if (!entitlements.themes.includes(selectedTheme)) {
            return res.status(403).json({
                success: false,
                code: "THEME_NOT_INCLUDED_IN_PLAN",
                message:
                    `The ${selectedTheme} theme is not included in your ` +
                    `${plan.name} plan. Please upgrade to access this theme.`,
                currentPlan: plan.key,
                allowedThemes: entitlements.themes,
            });
        }

        // Count the merchant's existing stores.
        const storeCount = await Store.countDocuments({
            owner: ownerId,
        });

        // A maxStores value of -1 means unlimited.
        if (
            entitlements.maxStores !== -1 &&
            storeCount >= entitlements.maxStores
        ) {
            return res.status(403).json({
                success: false,
                code: "STORE_LIMIT_REACHED",
                message:
                    `Your ${plan.name} plan allows ` +
                    `${entitlements.maxStores} store(s). ` +
                    "Upgrade your plan to create more stores.",
                currentPlan: plan.key,
                storeLimit: entitlements.maxStores,
                currentStoreCount: storeCount,
            });
        }

        // Generate and validate the store URL slug.
        const storeSlug = slugify(slug || storeName);

        if (!storeSlug) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid store name or URL.",
            });
        }

        // Check whether another store already uses this URL.
        const existingSlug = await Store.findOne({
            slug: storeSlug,
        }).select("_id");

        if (existingSlug) {
            return res.status(409).json({
                success: false,
                code: "STORE_SLUG_ALREADY_EXISTS",
                message:
                    "This store URL is already in use. Please choose another.",
            });
        }

        // Create the store.
        const store = await Store.create({
            owner: ownerId,
            businessName: businessName.trim(),
            storeName: storeName.trim(),
            slug: storeSlug,
            category: category.trim(),
            description:
                typeof description === "string"
                    ? description.trim()
                    : "",
            logoUrl:
                typeof logoUrl === "string"
                    ? logoUrl.trim()
                    : "",
            primaryColor: selectedPrimaryColor,
            secondaryColor: selectedSecondaryColor,
            theme: selectedTheme,
        });

        return res.status(201).json({
            success: true,
            message: "Your store has been created successfully.",
            store,
            plan: {
                key: plan.key,
                name: plan.name,
                maxStores: entitlements.maxStores,
                currentStoreCount: storeCount + 1,
            },
        });
    } catch (error) {
        // MongoDB duplicate-key error, such as a slug collision
        // caused by two requests arriving at nearly the same time.
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                code: "STORE_SLUG_ALREADY_EXISTS",
                message:
                    "This store URL is already in use. Please choose another.",
            });
        }

        console.error("Create store error:", error);
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
    const ownerId = req.user?._id || req.user?.userId || req.user?.id;

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const store = await Store.findOne({ owner: ownerId });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No store found.",
      });
    }

    return res.status(200).json({
      success: true,
      store,
    });
  } catch (error) {
    console.error("Get store error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your store.",
    });
  }
};


// GET /olatinn/api/store-front
const getMyStores = async (req, res) => {
    try {
        const ownerId = getAuthenticatedUserId(req);

        if (!ownerId) {
            return res.status(401).json({
                success: false,
                message: "Your session could not be verified. Please sign in again.",
            });
        }

        const stores = await Store.find({ owner: ownerId })
            .sort({ createdAt: -1 });

        const account = await getMerchantEntitlements(ownerId);

        return res.status(200).json({
            success: true,
            count: stores.length,
            stores,
            plan: account.plan,
            subscription: account.subscription,
            accessStatus: account.accessStatus,
            entitlements: account.entitlements,
        });
    } catch (error) {
        console.error("Get my stores error:", error);
        return handleDatabaseError(res, error);
    }
};



// GET /olatinn/api/store-front/:storeId
const getStoreById = async (req, res) => {
    try {
        const ownerId = getAuthenticatedUserId(req);
        const { storeId } = req.params;

        if (!ownerId) {
            return res.status(401).json({
                success: false,
                message: "Please sign in to continue.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(storeId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid store ID.",
            });
        }

        const store = await Store.findOne({
            _id: storeId,
            owner: ownerId,
        });

        if (!store) {
            return res.status(404).json({
                success: false,
                message: "Store not found or you do not have permission to access it.",
            });
        }

        return res.status(200).json({
            success: true,
            store,
        });
    } catch (error) {
        console.error("Get store by ID error:", error);
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

    // Fields the merchant is allowed to update
    const allowedFields = [
      "businessName",
      "storeName",
      "slug",
      "category",
      "description",
      "logoUrl",
      "primaryColor",
      "secondaryColor",
      "theme",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Validate business name
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

    // Validate store name
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

    // Validate category
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

    // Validate description
    if (
      updates.description !== undefined &&
      typeof updates.description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be valid text.",
      });
    }

    // Validate logo URL
    if (
      updates.logoUrl !== undefined &&
      typeof updates.logoUrl !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Logo URL must be valid text.",
      });
    }

    // Validate primary color
    if (updates.primaryColor !== undefined) {
      if (
        typeof updates.primaryColor !== "string" ||
        !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(
          updates.primaryColor
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid primary color.",
        });
      }
    }

    // Validate secondary color
    if (updates.secondaryColor !== undefined) {
      if (
        typeof updates.secondaryColor !== "string" ||
        !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(
          updates.secondaryColor
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid secondary color.",
        });
      }
    }

    // Validate selected theme
    if (updates.theme !== undefined) {
      const allowedThemes = ["modern", "minimal", "boutique"];

      if (!allowedThemes.includes(updates.theme)) {
        return res.status(400).json({
          success: false,
          message: "Please select a valid store theme.",
        });
      }
    }

    // Enforce the merchant's theme entitlement
if (updates.theme !== undefined) {
  const { plan, entitlements } =
    await getMerchantEntitlements(ownerId);

  if (!entitlements.themes.includes(updates.theme)) {
    return res.status(403).json({
      success: false,
      code: "THEME_NOT_INCLUDED_IN_PLAN",
      message:
        `The ${updates.theme} theme is not included in your ` +
        `${plan.name} plan. Please upgrade to access this theme.`,
      currentPlan: plan.key,
      allowedThemes: entitlements.themes,
    });
  }
}

    // Validate and generate store slug
    if (updates.slug !== undefined) {
      if (
        typeof updates.slug !== "string" ||
        !updates.slug.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid store URL.",
        });
      }

      updates.slug = slugify(updates.slug);

      if (!updates.slug) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid store URL.",
        });
      }
    }

    // Trim text fields
    for (const field of [
      "businessName",
      "storeName",
      "category",
      "description",
      "logoUrl",
    ]) {
      if (typeof updates[field] === "string") {
        updates[field] = updates[field].trim();
      }
    }

    // Find the authenticated user's store
    const store = await Store.findOne({ owner: ownerId });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No store was found for your account.",
      });
    }

    // Prevent another store from using the same slug
    if (updates.slug !== undefined) {
      const existingStore = await Store.findOne({
        slug: updates.slug,
        _id: { $ne: store._id },
      });

      if (existingStore) {
        return res.status(409).json({
          success: false,
          message: "This store URL is already in use. Please choose another.",
        });
      }
    }

    // Apply permitted updates
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
    console.error("Update store error:", error);
    return handleDatabaseError(res, error);
  }
};


// PATCH /olatinn/api/store-front/:storeId
const updateStoreById = async (req, res) => {
    try {
        const ownerId = getAuthenticatedUserId(req);
        const { storeId } = req.params;

        if (!ownerId) {
            return res.status(401).json({
                success: false,
                message: "Please sign in to update your store.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(storeId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid store ID.",
            });
        }

        const store = await Store.findOne({
            _id: storeId,
            owner: ownerId,
        });

        if (!store) {
            return res.status(404).json({
                success: false,
                message: "Store not found or you do not have permission to edit it.",
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
            "theme",
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide at least one field to update.",
            });
        }

        const requiredFields = [
            "businessName",
            "storeName",
            "category",
        ];

        for (const field of requiredFields) {
            if (
                Object.prototype.hasOwnProperty.call(updates, field) &&
                (
                    typeof updates[field] !== "string" ||
                    !updates[field].trim()
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: `${field} cannot be empty.`,
                });
            }
        }

        for (const field of ["description", "logoUrl"]) {
            if (
                Object.prototype.hasOwnProperty.call(updates, field) &&
                typeof updates[field] !== "string"
            ) {
                return res.status(400).json({
                    success: false,
                    message: `${field} must be text.`,
                });
            }
        }

        for (const field of ["primaryColor", "secondaryColor"]) {
            if (Object.prototype.hasOwnProperty.call(updates, field)) {
                if (
                    typeof updates[field] !== "string" ||
                    !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(
                        updates[field]
                    )
                ) {
                    return res.status(400).json({
                        success: false,
                        message: `${field} must be a valid hexadecimal color.`,
                    });
                }
            }
        }

        if (
            Object.prototype.hasOwnProperty.call(updates, "theme")
        ) {
            const account = await getMerchantEntitlements(ownerId);
            const allowedThemes = account.entitlements?.themes || [];

            if (!allowedThemes.includes(updates.theme)) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Your current plan does not include this store theme.",
                    allowedThemes,
                });
            }
        }

        if (Object.prototype.hasOwnProperty.call(updates, "slug")) {
            if (
                typeof updates.slug !== "string" ||
                !updates.slug.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid store URL.",
                });
            }

            updates.slug = slugify(updates.slug);

            if (!updates.slug) {
                return res.status(400).json({
                    success: false,
                    message: "The store URL is invalid.",
                });
            }

            const duplicateSlug = await Store.findOne({
                slug: updates.slug,
                _id: { $ne: store._id },
            });

            if (duplicateSlug) {
                return res.status(409).json({
                    success: false,
                    message: "This store URL is already in use.",
                });
            }
        }

        for (const field of [
            "businessName",
            "storeName",
            "category",
            "description",
            "logoUrl",
        ]) {
            if (
                Object.prototype.hasOwnProperty.call(updates, field)
            ) {
                updates[field] = updates[field].trim();
            }
        }

        Object.assign(store, updates);

        await store.save();

        return res.status(200).json({
            success: true,
            message: "Your store has been updated successfully.",
            store,
        });
    } catch (error) {
        console.error("Update store by ID error:", error);
        return handleDatabaseError(res, error);
    }
};


// GET /olatinn/api/store-front/public/:slug
const getPublicStore = async (req, res) => {
    try {
        const { slug } = req.params;

        if (typeof slug !== "string" || !slug.trim()) {
            return res.status(400).json({
                success: false,
                message: "A valid store URL is required.",
            });
        }

        const store = await Store.findOne({
            slug: slugify(slug),
            status: "published",
        }).select(
            "businessName storeName slug category description logoUrl primaryColor secondaryColor theme status publishedAt createdAt"
        );

        if (!store) {
            return res.status(404).json({
                success: false,
                message: "This store does not exist or is not currently published.",
            });
        }

        return res.status(200).json({
            success: true,
            store,
        });
    } catch (error) {
        console.error("Public store lookup error:", error);
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



// PATCH /olatinn/api/store-front/:storeId/publish
const publishStoreById = async (req, res) => {
    try {
        const ownerId = getAuthenticatedUserId(req);
        const { storeId } = req.params;

        if (!ownerId) {
            return res.status(401).json({
                success: false,
                message: "Please sign in to publish your store.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(storeId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid store ID.",
            });
        }

        const store = await Store.findOne({
            _id: storeId,
            owner: ownerId,
        });

        if (!store) {
            return res.status(404).json({
                success: false,
                message: "Store not found.",
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
        console.error("Publish store by ID error:", error);
        return handleDatabaseError(res, error);
    }
};



// PATCH /olatinn/api/store-front/:storeId/unpublish
const unpublishStoreById = async (req, res) => {
    try {
        const ownerId = getAuthenticatedUserId(req);
        const { storeId } = req.params;

        if (!ownerId) {
            return res.status(401).json({
                success: false,
                message: "Please sign in to continue.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(storeId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid store ID.",
            });
        }

        const store = await Store.findOne({
            _id: storeId,
            owner: ownerId,
        });

        if (!store) {
            return res.status(404).json({
                success: false,
                message: "Store not found.",
            });
        }

        store.status = "draft";

        await store.save();

        return res.status(200).json({
            success: true,
            message: "Your store has been unpublished.",
            store,
        });
    } catch (error) {
        console.error("Unpublish store error:", error);
        return handleDatabaseError(res, error);
    }
};



// DELETE /olatinn/api/store-front/:storeId
const deleteStore = async (req, res) => {
    try {
        const ownerId = getAuthenticatedUserId(req);
        const { storeId } = req.params;

        if (!ownerId) {
            return res.status(401).json({
                success: false,
                message: "Please sign in to delete your store.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(storeId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid store ID.",
            });
        }

        const store = await Store.findOne({
            _id: storeId,
            owner: ownerId,
        });

        if (!store) {
            return res.status(404).json({
                success: false,
                message: "Store not found or you do not have permission to delete it.",
            });
        }

        await Store.deleteOne({
            _id: store._id,
            owner: ownerId,
        });

        return res.status(200).json({
            success: true,
            message: "Your store has been deleted successfully.",
            deletedStoreId: storeId,
        });
    } catch (error) {
        console.error("Delete store error:", error);
        return handleDatabaseError(res, error);
    }
};

module.exports = {
  createStore,
  uploadStoreLogo,
  getMyStore,
  getMyStores,
  updateMyStore,
  updateMyStore,
  getPublicStore,
  publishStore,
  publishStoreById,
  unpublishStoreById,
  getStoreById,
  updateStoreById,
  deleteStore,
};