const mongoose = require("mongoose");

const designSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    link: { type: String },
    date: { type: Date, default: Date.now },
    slug: { type: String, unique: true },
    image: { type: String },
    likes: { type: Number, default: 0 },
    smiles: { type: Number, default: 0 },
    comments: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true } // ✅ adds createdAt and updatedAt automatically
);

const Design =
  mongoose.models.Design || mongoose.model("Design", designSchema);
  
module.exports = Design;
