const express = require("express");
const profileControllers = require("../controllers/profileControllers");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/user-profile", protect, profileControllers.createOrUpdateProfile);
router.get("/user", protect, profileControllers.getProfile);

module.exports = router;
