const express = require("express");
const upload = require("../middleware/multer");
const blogControllers = require("../controllers/blogControllers");

const router = express.Router();

router.post("/", upload.single("image"), blogControllers.createBlog);
router.get("/", blogControllers.getBlogs);
router.get("/:slug", blogControllers.getBlogBySlug);
router.put("/:id", upload.single("image"), blogControllers.updateBlog);
router.delete("/:id", blogControllers.deleteBlog);

module.exports = router;
