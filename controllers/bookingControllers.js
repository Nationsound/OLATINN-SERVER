const Booking = require("../models/bookingSchema");
const transporter = require("../config/mail");

// Create booking
const createBooking = async (req, res) => {
  try {
    const { service, websiteType, name, email } = req.body;

    if (!service || !name || !email) {
      return res
        .status(400)
        .json({ message: "Service, name, and email are required" });
    }

    const booking = await Booking.create({ service, websiteType, name, email });

    // Send confirmation email
    await transporter.sendMail({
      from: '"OLATINN" <olatinn25@gmail.com>',
      to: email,
      subject: "Your Booking with OLATINN is Confirmed 🎉",
      html: `
        <div style="font-family: Arial, sans-serif; padding:20px; border:1px solid #17acdd; border-radius:10px; background:#f9f9f9;">
          <h2 style="color:#17acdd;">Hi ${name},</h2>
          <p>Thank you for booking with <strong>Olusola Adebayo Tech and Innovation Limited</strong>!</p>
          <p>We’ve received your request for the service: <strong>${service}</strong>.</p>
          ${
            websiteType
              ? `<p>Selected website type: <strong>${websiteType}</strong></p>`
              : ""
          }
          <p style="margin-top:15px;">Our team will get back to you shortly to finalize the details.</p>
          <p style="color:#555;">We’re excited to work with you and build without defects 🚀.</p>
        </div>
      `,
    });

    res.status(201).json({
      message: "Booking submitted successfully, confirmation email sent",
      booking,
    });
  } catch (error) {
    console.error("❌ Booking creation failed:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Fetch all bookings
const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch bookings" });
  }
};

// Fetch single booking
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    res.status(200).json(booking);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch booking" });
  }
};

// Update booking
const updateBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    res.status(200).json({ message: "Booking updated", booking });
  } catch (error) {
    res.status(500).json({ message: "Failed to update booking" });
  }
};

// Delete booking
const deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    res.status(200).json({ message: "Booking deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete booking" });
  }
};

module.exports = {
  createBooking,
  getAllBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
};
