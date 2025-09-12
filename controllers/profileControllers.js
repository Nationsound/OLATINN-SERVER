const UserProfile = require("../models/profileSchema");

// Create or Update Profile
const createOrUpdateProfile = async (req, res) => {
  try {
    const userId = req.user.id; // from auth middleware
    const { fullName, address, age } = req.body;

    let profile = await UserProfile.findOne({ user: userId });

    if (profile) {
      // update existing
      profile.fullName = fullName || profile.fullName;
      profile.address = address || profile.address;
      profile.age = age || profile.age;
      await profile.save();
    } else {
      // create new
      profile = await UserProfile.create({ user: userId, fullName, address, age });
    }

    res.json({ message: "Profile saved successfully", profile });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await UserProfile.findOne({ user: userId }).populate("user", "email");
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createOrUpdateProfile, getProfile };
