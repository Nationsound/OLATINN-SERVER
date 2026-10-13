const express = require("express");
const router = express.Router();

const planControllers = require("../controllers/planController");

router.get("/", planControllers.getPlans);

module.exports = router;