
const express = require("express");
const storeControllers = require("../controllers/storeControllers");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/multer");

const router = express.Router();

// Public storefront lookup
router.get("/public/:slug", storeControllers.getPublicStore);

// Protected merchant routes
router.post(
  "/upload-logo",
  protect,
  upload.single("logo"),
  storeControllers.uploadStoreLogo
);

// Create a store
router.post("/", protect, storeControllers.createStore);

// List all stores belonging to the merchant
router.get("/", protect, storeControllers.getMyStores);

// Keep existing endpoints temporarily for frontend compatibility
router.get("/my-store", protect, storeControllers.getMyStore);
router.patch("/my-store", protect, storeControllers.updateMyStore);
router.patch(
  "/my-store/publish",
  protect,
  storeControllers.publishStore
);

// Manage a specific store by its MongoDB ID
router.patch(
  "/:storeId",
  protect,
  storeControllers.updateStoreById
);

router.patch(
  "/:storeId/publish",
  protect,
  storeControllers.publishStoreById
);

router.patch(
  "/:storeId/unpublish",
  protect,
  storeControllers.unpublishStoreById
);

router.delete(
  "/:storeId",
  protect,
  storeControllers.deleteStore
);

module.exports = router;