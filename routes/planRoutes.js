const express = require("express");
const router = express.Router();

const planControllers = require("../controllers/planControllers");

router.get("/", planControllers.getPlans);

module.exports = router;