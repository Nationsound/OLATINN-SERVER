const Blog = require("../models/blogSchema");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");

// ✅ Create Blog
const createBlog = async (req, res) => {
  try {
    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    let imageUrl = "";
    let imageId = "";

    if (req.file) {
      try {
        const filePath = req.file.path.replace(/\\/g, "/");

        const uploadRes = await cloudinary.uploader.upload(filePath, {
          folder: "blogs",
        });

        imageUrl = uploadRes.secure_url;
        imageId = uploadRes.public_id;

        // remove temp file
        fs.unlinkSync(req.file.path);
      } catch (cloudErr) {
        console.error("Cloudinary Upload Error:", cloudErr);
        return res.status(500).json({ message: "Cloudinary upload failed", error: cloudErr.message });
      }
    }

    const newBlog = await Blog.create({
      title: req.body.title,
      slug: req.body.slug,
      category: req.body.category,
      author: req.body.author,
      content: req.body.content,
      imageUrl,
      imageId,
    });

    res.status(201).json(newBlog);
  } catch (err) {
    console.error("Create Blog Error:", err);
    res.status(500).json({ message: "Error creating blog", error: err.message });
  }
};
// ✅ Get All Blogs
const getBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Get Blog by Slug
const getBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug });
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.json(blog);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Update Blog
// PUT /olatinn/api/blogs/:id
const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;

    // Handle file upload if needed
    let imageUrl = "";
    let imageId = "";
    if (req.file) {
      const uploadRes = await cloudinary.uploader.upload(req.file.path, {
        folder: "blogs",
      });
      imageUrl = uploadRes.secure_url;
      imageId = uploadRes.public_id;
      fs.unlinkSync(req.file.path);
    }

    const updatedBlog = await Blog.findByIdAndUpdate(
      id,
      {
        ...req.body,
        ...(imageUrl && { imageUrl }),
        ...(imageId && { imageId }),
      },
      { new: true }
    );

    if (!updatedBlog) return res.status(404).json({ message: "Blog not found" });

    res.status(200).json(updatedBlog);
  } catch (err) {
    res.status(500).json({ message: "Error updating blog", error: err.message });
  }
};


// ✅ Delete Blog
const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    if (blog.imageId) {
      await cloudinary.uploader.destroy(blog.imageId);
    }

    await blog.deleteOne();
    res.json({ message: "Blog deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createBlog,
  getBlogs,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
};
