const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fullName: { type: String, default: "" },
    address: { type: String, default: "" },
    age: { type: Number, default: null },
    // Add more profile fields as needed
  },
  { timestamps: true }
);

const UserProfile = mongoose.model("UserProfile", profileSchema);
module.exports = UserProfile;
