const express = require("express");
const authControllers = require("../controllers/authControllers");

const router = express.Router();

router.post("/signup", authControllers.registerUser);
router.post("/signin", authControllers.loginUser);
router.post("/signout", authControllers.logoutUser);

module.exports = router;
