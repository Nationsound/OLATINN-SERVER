
const express = require("express");
const storeControllers = require("../controllers/storeControllers");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/multer");
const router = express.Router();

// Public storefront lookup. Only published stores are returned.
router.get("/public/:slug", storeControllers.getPublicStore);

// Protected merchant routes.
router.post(
  "/upload-logo",
  protect,
  upload.single("logo"),
  storeControllers.uploadStoreLogo
);
router.post("/", protect, storeControllers.createStore);
router.get("/my-store", protect, storeControllers.getMyStore);
router.patch("/my-store", protect, storeControllers.updateMyStore);
router.patch("/my-store/publish", protect, storeControllers.publishStore);

module.exports = router;