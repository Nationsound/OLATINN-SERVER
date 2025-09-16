const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    service: {
      type: String,
      required: true,
    },
    websiteType: {
      type: String, // only filled if service === "Website"
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
