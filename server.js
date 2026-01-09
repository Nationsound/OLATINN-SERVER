"use strict";

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const morgan = require("morgan");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config();
const app = express();
const server = http.createServer(app); // ✅ Needed for Socket.io

// Database
const connectDB = require("./config/db");

// Routes
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const subscriberRoutes = require("./routes/subscriberRoutes");
const partnerRoutes = require("./routes/partnerRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const adminRoutes = require("./routes/adminRoutes");
const chatRoutes = require("./routes/chatRoutes");
const blogRoutes = require("./routes/blogRoutes");
const designRoutes = require("./routes/designRoutes");
const designCommentRoutes = require("./routes/designCommentRoutes");
const contactAndReviewRoutes = require("./routes/contactAndReviewRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");


// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'https://olatinnlimited.com', 'http://olatinn-api.us-east-1.elasticbeanstalk.com/', 'https://www.olatinnlimited.com'],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
}));

// ✅ Allowed origins for CORS
const allowedOrigins = [
  "http://localhost:3000",
  "https://olatinnlimited.com",
  "http://olatinn-api.us-east-1.elasticbeanstalk.com/",
  "https://www.olatinnlimited.com"
];

app.use(express.json());
app.use(morgan("dev"));

// Connect Database
connectDB();

// Routes
app.use("/olatinn/api/auth", authRoutes);
app.use("/olatinn/api/profile", profileRoutes);
app.use("/olatinn/api/subscribers", subscriberRoutes);
app.use("/olatinn/api/partners", partnerRoutes);
app.use("/olatinn/api/bookings", bookingRoutes);
app.use("/olatinn/api/admin", adminRoutes);
app.use("/olatinn/api/chat", chatRoutes);
app.use("/olatinn/api/blogs", blogRoutes);
app.use("/olatinn/api/designs", designRoutes);
app.use("/olatinn/api/designComments", designCommentRoutes);
app.use("/olatinn/api/contact-reviews", contactAndReviewRoutes);
app.use("/olatinn/api/invoices", invoiceRoutes);

// Sample root route
app.get("/", (req, res) => {
  res.send("OLATINN Backend is running 🚀");
});

// ✅ Socket.io setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins, // explicitly allow dev and prod
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

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

// Server listening
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
