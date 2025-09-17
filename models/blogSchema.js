const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    category: { type: String },
    author: { type: String },
    content: { type: String, required: true },
    imageUrl: { type: String }, // Cloudinary URL
    imageId: { type: String },  // Cloudinary public_id for deletion
  },
  { timestamps: true }
);

const Blog = mongoose.model("Blog", blogSchema);
module.exports = Blog;
