const express = require("express");
const router = express.Router();

const bookingControllers = require("../controllers/bookingControllers");

// Create booking
router.post("/booking", bookingControllers.createBooking);

// Get all bookings
router.get("/", bookingControllers.getAllBookings);

// Get single booking
router.get("/:id", bookingControllers.getBookingById);

// Update booking
router.put("/:id", bookingControllers.updateBooking);

// Delete booking
router.delete("/:id", bookingControllers.deleteBooking);

module.exports = router;
