const Partner = require("../models/partnerSchema");
const transporter = require("../config/mail"); // Gmail transporter

// ✅ Create Partner & send confirmation email
const createPartner = async (req, res) => {
  try {
    const { company, email } = req.body;

    if (!company || !email) {
      return res.status(400).json({ message: "Company and email are required" });
    }

    // Prevent duplicates
    const exists = await Partner.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "This email is already registered as a partner" });
    }

    const partner = await Partner.create({ company, email });

    // Send congratulatory email
    await transporter.sendMail({
      from: '"OLATINN" <olatinn25@gmail.com>', // use your Gmail
      to: `"${company}" <${email}>`,
      subject: "🎉 Welcome to OLATINN Partnership Program!",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
          <h2 style="color:#17acdd;">Congratulations ${company}</h2>
          <p>We’re excited to welcome you as a <strong>Partner at OLUSOLA ADEBAYO TECH AND INNOVATION LIMITED</strong>.</p>
          <p>Together, we’ll build innovative solutions and create more opportunities.</p>
          <p style="margin-top:20px;">Our team will contact you shortly with next steps.</p>
          <br/>
          <p style="color:gray;font-size:12px;">If you didn’t register as a partner, please ignore this email.</p>
        </div>
      `,
    });

    res.status(201).json({
      message: "Partner registered successfully. Confirmation email sent!",
      partner,
    });
  } catch (error) {
    console.error("Partner creation failed:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get all partners
const getAllPartners = async (req, res) => {
  try {
    const partners = await Partner.find().sort({ createdAt: -1 });
    res.status(200).json(partners);
  } catch (error) {
    console.error("Fetching partners failed:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get partner by ID
const getPartnerById = async (req, res) => {
  try {
    const partner = await Partner.findById(req.params.id);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }
    res.status(200).json(partner);
  } catch (error) {
    console.error("Fetching partner failed:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Update partner
const updatePartner = async (req, res) => {
  try {
    const { company, email } = req.body;
    const partner = await Partner.findByIdAndUpdate(
      req.params.id,
      { company, email },
      { new: true, runValidators: true }
    );

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    res.status(200).json({ message: "Partner updated successfully", partner });
  } catch (error) {
    console.error("Updating partner failed:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Delete partner
const deletePartner = async (req, res) => {
  try {
    const partner = await Partner.findByIdAndDelete(req.params.id);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }
    res.status(200).json({ message: "Partner removed successfully" });
  } catch (error) {
    console.error("Deleting partner failed:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createPartner,
  getAllPartners,
  getPartnerById,
  updatePartner,
  deletePartner,
};
