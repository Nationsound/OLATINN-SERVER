// routes/partner.routes.js
const express = require("express");
const router = express.Router();

const partnerControllers = require("../controllers/partnerControllers");

// Create partner
router.post("/", partnerControllers.createPartner);

// Get all partners
router.get("/", partnerControllers.getAllPartners);

// Get single partner by ID
router.get("/:id", partnerControllers.getPartnerById);

// Delete partner
router.delete("/:id", partnerControllers.deletePartner);

// Update partner
router.put("/id", partnerControllers.updatePartner);

module.exports = router;
