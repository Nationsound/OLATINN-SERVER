const express = require('express');
const mongoose = require('mongoose');
const dotenv = require("dotenv");
const morgan = require('morgan');
const cors = require('cors');
const http = require("http");
const { Server } = require("socket.io");

dotenv.config();
const app = express();
const server = http.createServer(app); // ✅ Socket.io needs this server instance

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const subscriberRoutes = require("./routes/subscriberRoutes");
const partnerRoutes = require('./routes/partnerRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatRoutes = require("./routes/chatRoutes");

// Middleware
app.use(morgan("dev"));
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000", credentials: true }));
app.use(express.json());

connectDB();

// Routes
app.use('/olatinn/api/auth', authRoutes);
app.use('/olatinn/api/profile', profileRoutes);
app.use("/olatinn/api/subscribers", subscriberRoutes);
app.use('/olatinn/api/partners', partnerRoutes);
app.use('/olatinn/api/bookings', bookingRoutes);
app.use('/olatinn/api/admin', adminRoutes);
app.use("/olatinn/api/chat", chatRoutes);

// Sample route
app.get("/", (req, res) => {
  res.send("OLATINN Backend is running 🚀");
});

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("New client connected", socket.id);

  socket.on("register", ({ type, name }) => {
    socket.data.type = type;
    socket.data.name = name;
    console.log(`${type} connected: ${name}`);
  });

  socket.on("send_message", ({ to, message, senderType }) => {
    io.sockets.sockets.forEach((s) => {
      if (s.data.type === to) {
        s.emit("receive_message", { message, senderType });
      }
    });
  });

  socket.on("disconnect", () => {
    console.log(`${socket.data.name || "Client"} disconnected`);
  });
});

// ✅ Use server.listen instead of app.listen
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
