require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER || "olatinn25@gmail.com",
    pass: process.env.GMAIL_APP_PASS, 
  },
});

module.exports = transporter;
