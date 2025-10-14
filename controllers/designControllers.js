const Design = require("../models/designSchema");
const cloudinary = require("../config/cloudinary");

// Create new design
const createDesign = async (req, res) => {
  try {
    const { title, description, link, date, slug } = req.body;

    let imageUrl = "";
    if (req.file) {
      const uploadResponse = await cloudinary.uploader.upload(req.file.path, {
        folder: "designs",
      });
      imageUrl = uploadResponse.secure_url;
    }

    const newDesign = new Design({
      title,
      description,
      link,
      date,
      slug,
      image: imageUrl,
    });

    await newDesign.save();
    res.status(201).json(newDesign);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get all designs
const getDesigns = async (req, res) => {
  try {
    const designs = await Design.find().sort({ createdAt: -1 });
    res.json(designs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get latest design
const getLatestDesign = async (req, res) => {
  try {
    // ✅ Sort by createdAt (for new posts) and _id (for old posts)
    const design = await Design.findOne().sort({ createdAt: -1, _id: -1 });

    if (!design) {
      return res.status(404).json({ message: "No design posts found" });
    }

    res.status(200).json(design);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getDesignById = async (req, res) => {
  try {
    const { id } = req.params; // designId
    const design = await Design.findById(id);

    if (!design) {
      return res.status(404).json({ message: "Design not found" });
    }

    res.json(design);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update design
const updateDesign = async (req, res) => {
  try {
    const { title, description, link, date, slug } = req.body;

    let updateData = { title, description, link, date, slug };

    if (req.file) {
      const uploadResponse = await cloudinary.uploader.upload(req.file.path, {
        folder: "designs",
      });
      updateData.image = uploadResponse.secure_url;
    }

    const updated = await Design.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete design
const deleteDesign = async (req, res) => {
  try {
    await Design.findByIdAndDelete(req.params.id);
    res.json({ message: "Design deleted" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const design = await Design.findById(id);

    if (!design) return res.status(404).json({ message: "Design not found" });

    const userId = req.user._id.toString();
    // Track if user has already liked using a Set (or could add a separate array if needed)
    // For simplicity, just increment/decrement likes count
    const likedKey = `likedBy_${userId}`;
    if (design[likedKey]) {
      design.likes = Math.max(0, design.likes - 1);
      design[likedKey] = false;
    } else {
      design.likes += 1;
      design[likedKey] = true;
    }

    await design.save();

    res.json(design);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


module.exports = {
  createDesign,
  getDesigns,
  getLatestDesign,
  getDesignById,
  updateDesign,
  deleteDesign,
  toggleLike,
};
