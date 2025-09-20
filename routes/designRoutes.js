const express = require("express");
const designControllers = require("../controllers/designControllers");
const upload = require('../middleware/multer');
const {protect} = require('../middleware/authMiddleware')

const router = express.Router();

// Routes
router.post("/", upload.single("image"), designControllers.createDesign);         // Admin only
router.get("/", designControllers.getDesigns);
router.get("/latest", designControllers.getLatestDesign);
router.get("/:id", designControllers.getDesignById);
router.put("/:id", upload.single("image"), designControllers.updateDesign);       // Admin only
router.delete("/:id", designControllers.deleteDesign);    // Admin only
router.patch("/like/:id", protect, designControllers.toggleLike);

module.exports = router; 
