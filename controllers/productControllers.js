const mongoose = require("mongoose");

const cloudinary = require("../config/cloudinary");

const Store = require("../models/storeSchema");
const Product = require("../models/productSchema");

const {
  getMerchantEntitlements,
} = require("../services/storeEntitlementService");

// ========================================
// Helpers
// ========================================

const getAuthenticatedUserId = (req) => {
  const userId =
    req.user?._id ||
    req.user?.userId ||
    req.user?.id;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  return new mongoose.Types.ObjectId(userId);
};

const isValidObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

const slugify = (value = "") =>
  String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const handleDatabaseError = (res, error) => {
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message:
        "A product with this name or URL slug already exists in this store.",
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Please check the product information.",
      errors: Object.values(error.errors).map(
        (item) => item.message
      ),
    });
  }
 
  console.error("Product controller error:", error);

  return res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
};

// Ensure the authenticated merchant owns the store.
const findOwnedStore = async (storeId, ownerId) => {
  if (!isValidObjectId(storeId)) {
    return null;
  }

  return Store.findOne({
    _id: storeId,
    owner: ownerId,
  });
};

// Generate a unique slug within a particular store.
const createUniqueProductSlug = async (
  storeId,
  name,
  excludeProductId = null
) => {
  const baseSlug = slugify(name);

  if (!baseSlug) {
    throw new Error(
      "The product name must contain letters or numbers."
    );
  }

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = {
      store: storeId,
      slug,
    };

    if (excludeProductId) {
      query._id = { $ne: excludeProductId };
    }

    const existingProduct = await Product.findOne(query)
      .select("_id")
      .lean();

    if (!existingProduct) {
      return slug;
    }

    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
};

// ========================================
// CREATE PRODUCT
// POST /olatinn/api/products/store/:storeId
// ========================================

const createProduct = async (req, res) => {
    let uploadedImagePublicId = null;

    try {
        const ownerId = getAuthenticatedUserId(req);

        if (!ownerId) {
            return res.status(401).json({
                success: false,
                message: "Authentication is required.",
            });
        }

        // Multer parses multipart/form-data.
        // This fallback also prevents destructuring undefined.
        const body = req.body || {};

        const { storeId } = req.params;

        const {
            name,
            description,
            category,
            brand,
            sku,
            price,
            compareAtPrice,
            stockQuantity,
            trackInventory,
            isFeatured,
            imageAlt,
        } = body;

        // Validate product name.
        if (
            typeof name !== "string" ||
            !name.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Product name is required.",
            });
        }

        // Validate price.
        if (
            price === undefined ||
            price === null ||
            price === "" ||
            !Number.isFinite(Number(price)) ||
            Number(price) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid product price.",
            });
        }

        // Validate comparison price when provided.
        if (
            compareAtPrice !== undefined &&
            compareAtPrice !== null &&
            compareAtPrice !== "" &&
            (
                !Number.isFinite(Number(compareAtPrice)) ||
                Number(compareAtPrice) < 0
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid comparison price.",
            });
        }

        // Validate stock quantity.
        if (
            stockQuantity !== undefined &&
            (
                !Number.isInteger(Number(stockQuantity)) ||
                Number(stockQuantity) < 0
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Stock quantity must be a non-negative whole number.",
            });
        }

        // Validate uploaded image.
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please select a product image to upload.",
            });
        }

        // Confirm that the merchant owns this store.
        const store = await findOwnedStore(storeId, ownerId);

        if (!store) {
            return res.status(404).json({
                success: false,
                message:
                    "Store not found, or you do not have permission to manage it.",
            });
        }

        // Retrieve the merchant's plan and product limit.
        const entitlementData =
            await getMerchantEntitlements(ownerId);

        const entitlements =
            entitlementData?.entitlements || {};

        const productLimit = Number(
            entitlements.maxProductsPerStore
        );

        if (
            !Number.isInteger(productLimit) ||
            productLimit < -1
        ) {
            return res.status(500).json({
                success: false,
                message:
                    "The product limit is missing or incorrectly configured for your plan.",
            });
        }

        // A limit of -1 means unlimited products.
        if (productLimit !== -1) {
            const currentProductCount =
                await Product.countDocuments({
                    store: store._id,
                    owner: ownerId,
                });

            if (currentProductCount >= productLimit) {
                return res.status(403).json({
                    success: false,
                    code: "PRODUCT_LIMIT_REACHED",
                    message:
                        "You have reached the product limit for your current plan.",
                    productLimit,
                    currentProductCount,
                    plan: entitlementData.plan?.name,
                });
            }
        }

        // Generate a unique product URL.
        const productSlug = await createUniqueProductSlug(
            store._id,
            name
        );

        // Upload the image to Cloudinary.
        const uploadResponse = await cloudinary.uploader.upload(
            req.file.path,
            {
                folder: "olatinn-products",
                resource_type: "image",
            }
        );

        uploadedImagePublicId = uploadResponse.public_id;

        // Convert multipart form values to actual booleans.
        const parsedTrackInventory =
            trackInventory === undefined
                ? true
                : String(trackInventory) === "true";

        const parsedIsFeatured =
            isFeatured === undefined
                ? false
                : String(isFeatured) === "true";

        // Save product and Cloudinary image URL in MongoDB.
        const product = await Product.create({
            store: store._id,
            owner: ownerId,

            name: name.trim(),
            slug: productSlug,

            description:
                typeof description === "string"
                    ? description.trim()
                    : "",

            category:
                typeof category === "string"
                    ? category.trim()
                    : "",

            brand:
                typeof brand === "string"
                    ? brand.trim()
                    : "",

            sku:
                typeof sku === "string"
                    ? sku.trim()
                    : "",

            price: Number(price),

            compareAtPrice:
                compareAtPrice === undefined ||
                compareAtPrice === null ||
                compareAtPrice === ""
                    ? null
                    : Number(compareAtPrice),

            stockQuantity:
                stockQuantity === undefined ||
                stockQuantity === ""
                    ? 0
                    : Number(stockQuantity),

            trackInventory: parsedTrackInventory,

            images: [
                {
                    url: uploadResponse.secure_url,
                    alt:
                        typeof imageAlt === "string" &&
                        imageAlt.trim()
                            ? imageAlt.trim()
                            : name.trim(),
                },
            ],

            isFeatured: parsedIsFeatured,

            status: "draft",
            publishedAt: null,
        });

        return res.status(201).json({
            success: true,
            message:
                "Product created successfully as a draft.",
            product,
        });
    } catch (error) {
        console.error("Create product error:", error);

        // If MongoDB creation fails after the image upload,
        // remove the uploaded image to avoid an orphaned asset.
        if (uploadedImagePublicId) {
            try {
                await cloudinary.uploader.destroy(
                    uploadedImagePublicId,
                    {
                        resource_type: "image",
                    }
                );
            } catch (cleanupError) {
                console.error(
                    "Cloudinary cleanup failed:",
                    cleanupError
                );
            }
        }

        return handleDatabaseError(res, error);
    }
};

// ========================================
// LIST PRODUCTS FOR AN OWNED STORE
// GET /olatinn/api/products/store/:storeId
// ========================================

const getStoreProducts = async (req, res) => {
  try {
    const ownerId = getAuthenticatedUserId(req);

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    const store = await findOwnedStore(
      req.params.storeId,
      ownerId
    );

    if (!store) {
      return res.status(404).json({
        success: false,
        message:
          "Store not found, or you do not have permission to manage it.",
      });
    }

    const products = await Product.find({
      store: store._id,
      owner: ownerId,
    }).sort({ createdAt: -1 });

    const entitlementData =
      await getMerchantEntitlements(ownerId);

    const productLimit = Number(
      entitlementData.entitlements?.maxProductsPerStore
    );

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
      store: {
        _id: store._id,
        storeName: store.storeName,
        slug: store.slug,
        status: store.status,
      },
      plan: entitlementData.plan?.name,
      productLimit,
      remainingProducts:
        productLimit === -1
          ? null
          : Math.max(0, productLimit - products.length),
    });
  } catch (error) {
    return handleDatabaseError(res, error);
  }
};

// ========================================
// GET ONE PRODUCT
// GET /olatinn/api/products/:productId
// ========================================

const getProductById = async (req, res) => {
  try {
    const ownerId = getAuthenticatedUserId(req);

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      owner: ownerId,
    }).populate("store", "storeName slug status");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    return handleDatabaseError(res, error);
  }
};

// ========================================
// UPDATE PRODUCT
// PATCH /olatinn/api/products/:productId
// ========================================

const updateProduct = async (req, res) => {
  try {
    const ownerId = getAuthenticatedUserId(req);

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      owner: ownerId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const allowedFields = [
      "name",
      "description",
      "category",
      "brand",
      "sku",
      "price",
      "compareAtPrice",
      "stockQuantity",
      "trackInventory",
      "images",
      "isFeatured",
      "seo",
    ];

    for (const field of allowedFields) {
      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          field
        )
      ) {
        product[field] = req.body[field];
      }
    }

    if (
      req.body.name !== undefined &&
      String(req.body.name).trim()
    ) {
      product.name = String(req.body.name).trim();

      product.slug = await createUniqueProductSlug(
        product.store,
        product.name,
        product._id
      );
    }

    if (req.body.price !== undefined) {
      if (
        req.body.price === "" ||
        !Number.isFinite(Number(req.body.price)) ||
        Number(req.body.price) < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid product price.",
        });
      }

      product.price = Number(req.body.price);
    }

    if (req.body.compareAtPrice !== undefined) {
      const value = req.body.compareAtPrice;

      if (
        value !== null &&
        value !== "" &&
        (
          !Number.isFinite(Number(value)) ||
          Number(value) < 0
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid comparison price.",
        });
      }

      product.compareAtPrice =
        value === null || value === ""
          ? null
          : Number(value);
    }

    if (req.body.stockQuantity !== undefined) {
      const quantity = Number(req.body.stockQuantity);

      if (
        !Number.isInteger(quantity) ||
        quantity < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Stock quantity must be a non-negative whole number.",
        });
      }

      product.stockQuantity = quantity;
    }

    if (req.body.images !== undefined) {
      if (
        !Array.isArray(req.body.images) ||
        req.body.images.length > 10
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A product can have a maximum of 10 images.",
        });
      }

      product.images = req.body.images;
    }

    if (
      req.body.name !== undefined &&
      !String(req.body.name).trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Product name cannot be empty.",
      });
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      product,
    });
  } catch (error) {
    return handleDatabaseError(res, error);
  }
};

// ========================================
// PUBLISH PRODUCT
// PATCH /olatinn/api/products/:productId/publish
// ========================================

const publishProduct = async (req, res) => {
  try {
    const ownerId = getAuthenticatedUserId(req);

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      owner: ownerId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const store = await Store.findOne({
      _id: product.store,
      owner: ownerId,
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "The product's store could not be found.",
      });
    }

    if (store.status !== "published") {
      return res.status(400).json({
        success: false,
        code: "STORE_NOT_PUBLISHED",
        message:
          "Publish your store before publishing its products.",
      });
    }

    if (product.status === "archived") {
      return res.status(400).json({
        success: false,
        message:
          "Restore this product from archived status before publishing it.",
      });
    }

    product.status = "published";
    product.publishedAt = new Date();

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product published successfully.",
      product,
    });
  } catch (error) {
    return handleDatabaseError(res, error);
  }
};

// ========================================
// UNPUBLISH PRODUCT
// PATCH /olatinn/api/products/:productId/unpublish
// ========================================

const unpublishProduct = async (req, res) => {
  try {
    const ownerId = getAuthenticatedUserId(req);

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      owner: ownerId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    product.status = "draft";
    product.publishedAt = null;

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product unpublished successfully.",
      product,
    });
  } catch (error) {
    return handleDatabaseError(res, error);
  }
};

// ========================================
// DELETE PRODUCT
// DELETE /olatinn/api/products/:productId
// ========================================

const deleteProduct = async (req, res) => {
  try {
    const ownerId = getAuthenticatedUserId(req);

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findOneAndDelete({
      _id: productId,
      owner: ownerId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found, or you do not have permission to delete it.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully.",
      productId,
    });
  } catch (error) {
    return handleDatabaseError(res, error);
  }
};

// ========================================
// PUBLIC PRODUCTS FOR A PUBLISHED STORE
// GET /olatinn/api/products/public/store/:slug
// ========================================

const getPublicStoreProducts = async (req, res) => {
  try {
    const storeSlug = slugify(req.params.slug);

    const store = await Store.findOne({
      slug: storeSlug,
      status: "published",
    }).select(
      "_id storeName slug businessName description logoUrl primaryColor secondaryColor theme currency"
    );

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found.",
      });
    }

    const products = await Product.find({
      store: store._id,
      status: "published",
    })
      .select(
        "name slug description category brand price compareAtPrice stockQuantity trackInventory images isFeatured publishedAt seo"
      )
      .sort({ isFeatured: -1, publishedAt: -1 });

    return res.status(200).json({
      success: true,
      store,
      count: products.length,
      products,
    });
  } catch (error) {
    return handleDatabaseError(res, error);
  }
};

module.exports = {
  createProduct,
  getStoreProducts,
  getProductById,
  updateProduct,
  publishProduct,
  unpublishProduct,
  deleteProduct,
  getPublicStoreProducts,
};