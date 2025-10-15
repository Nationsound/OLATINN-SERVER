const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    clientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    services: [
      {
        description: { type: String, required: true },
        amount: { type: Number, required: true },
      },
    ],
    total: { type: Number, required: true },
    deposit: { type: Number, default: 0 }, // New field
    balanceDue: { type: Number, default: 0 }, // New field
    currency: { type: String, default: "₦" }, //New field
    paymentStatus: { // Updated field for status
      type: String,
      enum: ["PAID", "PENDING", "CANCELLED"],
      default: "PENDING",
    },
    dueDate: { type: Date },
    invoiceNumber: {
      type: String,
      unique: true,
    },
    logoUrl: { type: String, default: "" }, // Company logo
    stampUrl: { type: String, default: "" }, // Stamp
    pdfPath: { type: String },
  },
  { timestamps: true }
);

// Auto-generate invoice number before save
invoiceSchema.pre("save", function (next) {
  if (!this.invoiceNumber) {
    this.invoiceNumber = "INV-" + Date.now();
  }
  next();
});

module.exports = mongoose.model("Invoice", invoiceSchema);
