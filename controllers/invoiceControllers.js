const Invoice = require("../models/invoiceSchema");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const transporter = require("../config/mail");
const cloudinary = require("../config/cloudinary"); // ✅ Cloudinary config
const multer = require("multer");

// Temporary upload folder (before sending to Cloudinary)
const upload = multer({ dest: "uploads/" });

// 🧾 Create Invoice, Generate PDF & Email it
const createInvoice = async (req, res) => {
  try {
    const { userId, clientName, clientEmail, services, deposit = 0, dueDate, stampUrl, currency } = req.body;
    
    const invoiceCurrency = currency || "₦";

    // ✅ Validate required fields
    if (!clientName || !clientEmail || !services) {
      return res.status(400).json({ error: "Client name, email, and services are required." });
    }

    // ✅ Parse services safely
    let parsedServices = [];
    try {
      parsedServices = typeof services === "string" ? JSON.parse(services) : services;
    } catch (err) {
      return res.status(400).json({ error: "Invalid services format. Must be an array." });
    }

    if (!Array.isArray(parsedServices) || parsedServices.length === 0) {
      return res.status(400).json({ error: "At least one service is required." });
    }

    // ✅ Upload company logo if provided
    let logoUrl = "";
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, { folder: "olatinn_invoices" });
      logoUrl = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    // ✅ Compute totals
    const totalAmount = parsedServices.reduce((sum, item) => sum + Number(item.amount), 0);
    const depositAmount = Number(deposit) || 0;
    const balanceDue = totalAmount - depositAmount;
    const paymentStatus = balanceDue <= 0 ? "PAID" : "PENDING";

    // ✅ Create invoice document
    const invoice = new Invoice({
      userId,
      clientName,
      clientEmail,
      services: parsedServices,
      total: totalAmount,
      deposit: depositAmount,
      balanceDue,
      paymentStatus,
      dueDate,
      stampUrl: stampUrl || "",
      logoUrl: logoUrl || "",
    });

    await invoice.save();

    // ===== PDF Generation =====
    const pdfDir = path.join(__dirname, "..", "invoices");
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir);

    const pdfPath = path.join(pdfDir, `${invoice.invoiceNumber}.pdf`);
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    const olatinnColor = "#000271";

    const logoWidth = 80;
const rightMargin = 50;

if (logoUrl) {
  // If logo is a URL, use it directly
  try {
    // PDFKit supports passing URLs if you load them as a buffer
    const axios = require("axios");
    const response = await axios.get(logoUrl, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data, "binary");
    const x = doc.page.width - logoWidth - rightMargin;
    doc.image(buffer, x, 45, { width: logoWidth });
  } catch (err) {
    console.warn("Logo from URL could not be added:", err.message);
  }
} else {
  // Local fallback
  const localLogoPath = path.join(__dirname, "..", "assets", "logo.png");
  if (fs.existsSync(localLogoPath)) {
    const x = doc.page.width - logoWidth - rightMargin;
    try {
      doc.image(localLogoPath, x, 45, { width: logoWidth });
    } catch (err) {
      console.warn("Local logo could not be added:", err.message);
    }
  }
}




    doc
      .fillColor(olatinnColor)
      .fontSize(25)
      .font("Helvetica-Bold")
      .text("OLUSOLA ADEBAYO TECH AND INNOVATION LIMITED", 10, 10)
      .moveDown(1);

    doc
      .fillColor(olatinnColor)
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("INVOICE", 80, 80)
      .moveDown(1);

    // ===== Invoice Details (top-left) =====
    const detailY = 120;
    doc.fontSize(12)
      .font("Helvetica")
      .fillColor("black")
      .text(`Invoice #: ${invoice.invoiceNumber}`, 50, detailY)
      .text(`Issue Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 50)
      .text(`Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "N/A"}`, 50)
      .text(`Payment Status: ${paymentStatus}`, 50);

    // ===== Client Info =====
    doc.moveDown(1.5)
      .text(`Billed To: ${invoice.clientName}`, 50)
      .text(`Email: ${invoice.clientEmail}`, 50)
      .moveDown(1);

    // ===== Services Table =====
    const tableTop = doc.y;
    doc.font("Helvetica-Bold").fillColor(olatinnColor)
      .text("No", 50)
      .text("Description", 100, tableTop,)
      .text(`Amount (${invoiceCurrency || "₦"})`, 400, tableTop, { align: "right" });

    doc.moveDown(0.3).font("Helvetica").fillColor("black");
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    let rowY = tableTop + 25; // start a bit below header
parsedServices.forEach((srv, idx) => {
  // Alternate row shading
  if (idx % 2 === 0) {
    doc.rect(50, rowY - 2, 500, 20).fillOpacity(0.05).fill(olatinnColor).fillOpacity(1);
  }

  doc.fillColor("black")
     .text(idx + 1, 50, rowY)                       // No column
     .text(srv.description, 100, rowY)             // Description column (x = 100)
     .text(`${invoiceCurrency}${Number(srv.amount).toLocaleString()}`, 400, rowY, { align: "right" }); // Amount

  rowY += 20; // move Y manually for next row
});


    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // ===== Totals / Deposit / Balance =====
    doc.font("Helvetica-Bold").fillColor(olatinnColor)
      .text(`Total: ${invoiceCurrency}${totalAmount.toLocaleString()}`, { align: "right" })
  .text(`Deposit: ${invoiceCurrency}${depositAmount.toLocaleString()}`, { align: "right" })
  .text(`Balance Due: ${invoiceCurrency}${balanceDue.toLocaleString()}`, { align: "right" })
      .moveDown(1);

    // ===== Stamp =====
    const stampPath = invoice.stampUrl || path.join(__dirname, "..", "assets", "stamp.png");
    if (fs.existsSync(stampPath)) {
      try {
        doc.image(stampPath, 400, doc.y, { width: 120, opacity: 0.8 });
      } catch (err) {
        console.warn("Stamp could not be added:", err.message);
      }
    }

    // ===== Footer =====
    doc.moveDown(4);
    doc.fillColor("black").fontSize(12)
      .font("Helvetica")
      .text("Approved by: Olusola Adebayo Tech and Inn. Ltd", 50, doc.y, { align: "left" });

    doc.end();

    writeStream.on("finish", async () => {
      invoice.pdfPath = pdfPath;
      await invoice.save();

      // ✅ Send email
      const mailOptions = {
        from: `"Olusola Adebayo Tech & Inn. Ltd." <${process.env.GMAIL_USER}>`,
        to: clientEmail,
        subject: `Invoice ${invoice.invoiceNumber} from Olusola Adebayo Tech & Inn. Ltd.`,
        text: `Dear ${clientName},\n\nPlease find attached your official invoice.\n\nThank you for your business!\n\nBest regards,\nOlusola Adebayo Tech and Inn. Ltd.`,
        attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, path: pdfPath }],
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Invoice ${invoice.invoiceNumber} sent to ${clientEmail}`);
      } catch (err) {
        console.error("❌ Email sending failed:", err);
      }

      res.status(201).json({ message: "Invoice created and emailed successfully", invoice });
    });

    writeStream.on("error", (err) => {
      console.error("PDF generation error:", err);
      res.status(500).json({ error: "Error generating PDF" });
    });

  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ error: "Server error while creating invoice" });
  }
};


// 📋 Get All Invoices
const getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    res.status(200).json(invoices);
  } catch (error) {
    res.status(500).json({ error: "Error fetching invoices" });
  }
};

// 📄 Get Single Invoice
const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.status(200).json(invoice);
  } catch (error) {
    res.status(500).json({ error: "Error fetching invoice" });
  }
};

// 📥 Download Invoice PDF
const downloadInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice || !invoice.pdfPath)
      return res.status(404).json({ error: "Invoice PDF not found" });

    res.download(invoice.pdfPath);
  } catch (error) {
    res.status(500).json({ error: "Error downloading invoice" });
  }
};

// ✏️ Update Invoice
const updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.status(200).json({ message: "Invoice updated successfully", invoice });
  } catch (error) {
    res.status(500).json({ error: "Error updating invoice" });
  }
};

// ❌ Delete Invoice
const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.status(200).json({ message: "Invoice deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting invoice" });
  }
};

module.exports = {
  createInvoice,
  getInvoices,
  getInvoiceById,
  downloadInvoice,
  updateInvoice,
  deleteInvoice,
  upload, // export multer middleware for route use
};
