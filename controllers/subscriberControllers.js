const Subscriber = require("../models/subscriberSchema");
const transporter = require("../config/mail");

// ✅ Create subscriber & send confirmation email
const createSubscriber = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if already subscribed
    let subscriber = await Subscriber.findOne({ email });

    if (!subscriber) {
      subscriber = await Subscriber.create({ name, email });
    }

    // Styled HTML email template
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #17acdd; padding: 20px; text-align: center; color: #fff;">
          <h1 style="margin: 0; font-size: 24px;">Welcome to OLATINN 🎉</h1>
        </div>
        <div style="padding: 20px; color: #333;">
          <h2 style="color: #17acdd;">Hi ${name || "there"},</h2>
          <p>Thanks for subscribing to <b>Olusola Adebayo Tech and Innovation Limited</b>!</p>
          <p>We’re thrilled to have you on board. Stay tuned for exclusive news, updates, and special offers.</p>
          <p style="margin-top: 20px;">Here’s to building amazing things together.</p>
          <a href="https://olatinn.com" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #17acdd; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">Visit OLATINN</a>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          <p>If you did not subscribe, you can safely ignore this email.</p>
          <p>&copy; ${new Date().getFullYear()} OLATINN. All rights reserved.</p>
        </div>
      </div>
    `;

    // Send confirmation email
    const info = await transporter.sendMail({
      from: `"OLATINN" <olatinn25@gmail.com>`,
      to: `"${name || "Valued Subscriber"}" <${email}>`,
      subject: "Welcome to OLATINN Newsletter",
      html: htmlTemplate,
    });

    console.log("✅ Gmail response:", info);

    return res.status(200).json({
      message: "Subscription confirmed. Confirmation email sent!",
      subscriber,
    });

  } catch (error) {
    console.error("❌ Subscriber creation or email failed:", error);
    return res.status(500).json({ message: error.message });
  }
};


// ✅ Get all subscribers
const getAllSubscribers = async (req, res) => {
  try {
    const subscribers = await Subscriber.find().sort({ createdAt: -1 });
    res.status(200).json(subscribers);
  } catch (error) {
    console.error("Fetching subscribers failed:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get subscriber by ID
const getSubscriberById = async (req, res) => {
  try {
    const subscriber = await Subscriber.findById(req.params.id);
    if (!subscriber) {
      return res.status(404).json({ message: "Subscriber not found" });
    }
    res.status(200).json(subscriber);
  } catch (error) {
    console.error("Fetching subscriber failed:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Update subscriber
const updateSubscriber = async (req, res) => {
  try {
    const { name, email } = req.body;

    const subscriber = await Subscriber.findByIdAndUpdate(
      req.params.id,
      { name, email },
      { new: true, runValidators: true }
    );

    if (!subscriber) {
      return res.status(404).json({ message: "Subscriber not found" });
    }

    res.status(200).json({
      message: "Subscriber updated successfully",
      subscriber,
    });
  } catch (error) {
    console.error("Updating subscriber failed:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Delete subscriber
const deleteSubscriber = async (req, res) => {
  try {
    const subscriber = await Subscriber.findByIdAndDelete(req.params.id);
    if (!subscriber) {
      return res.status(404).json({ message: "Subscriber not found" });
    }
    res.status(200).json({ message: "Subscriber removed successfully" });
  } catch (error) {
    console.error("Deleting subscriber failed:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createSubscriber,
  getAllSubscribers,
  getSubscriberById,
  updateSubscriber,
  deleteSubscriber,
};
