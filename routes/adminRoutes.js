const express = require("express");
const router = express.Router();
const adminControllers = require("../controllers/adminControllers");
const { protectAdmin } = require("../middleware/authMiddleware");

// ✅ Auth routes (public)
router.post("/register", adminControllers.registerAdmin); // optional: if only admins can register, keep protectAdmin
router.post("/login", adminControllers.loginAdmin);

// ✅ Admin management (protected)
router.get("/list", protectAdmin, adminControllers.listAdmins);
router.put("/:id", protectAdmin, adminControllers.updateAdmin);
router.delete("/:id", protectAdmin, adminControllers.deleteAdmin);

// ✅ Forgotten password (public)
router.post("/forgot-password", adminControllers.forgotPassword);

module.exports = router;
