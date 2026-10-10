const express = require("express");
const productControllers = require("../controllers/productControllers");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/multer");

const router = express.Router();

// Public product listing
router.get(
    "/public/store/:slug",
    productControllers.getPublicStoreProducts
);

// Protected merchant product routes
router.post(
    "/store/:storeId",
    protect,
    upload.single("image"),
    productControllers.createProduct
);

router.get(
    "/store/:storeId",
    protect,
    productControllers.getStoreProducts
); 

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