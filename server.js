const express = require('express');
const mongoose = require('mongoose');
const dotenv = require("dotenv");
const morgan = require('morgan');
const cors = require('cors');

dotenv.config();
const app = express();

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');

// Middleware
app.use(morgan("dev"));  // 👈 logs requests to console
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

connectDB();

//Routes
app.use('/olatinn/api/auth', authRoutes);
app.use('/olatinn/api/profile', profileRoutes);

// Sample route
app.get("/", (req, res) => {
  res.send("OLATINN Backend is running 🚀");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));