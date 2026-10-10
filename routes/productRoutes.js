const express = require("express");

const productControllers = require("../controllers/productControllers");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// ========================================
// Public product listing
// ========================================

router.get(
  "/public/store/:slug",
  productControllers.getPublicStoreProducts
);

// ========================================
// Protected merchant product routes
// ========================================

// Create a product for a specific store
router.post(
  "/store/:storeId",
  protect,
  productControllers.createProduct
);

// List products belonging to a specific store
router.get(
  "/store/:storeId",
  protect,
  productControllers.getStoreProducts
);

// Publish or unpublish a product
router.patch(
  "/:productId/publish",
  protect,
  productControllers.publishProduct
);

router.patch(
  "/:productId/unpublish",
  protect,
  productControllers.unpublishProduct
);

// Get, edit, or delete an individual product
router.get(
  "/:productId",
  protect,
  productControllers.getProductById
);

router.patch(
  "/:productId",
  protect,
  productControllers.updateProduct
);

router.delete(
  "/:productId",
  protect,
  productControllers.deleteProduct
);

module.exports = router;