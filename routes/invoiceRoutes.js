const express = require("express");
const router = express.Router();
const upload = require('../middleware/multer')
const invoiceController = require("../controllers/invoiceControllers");

// 🧾 CRUD Routes
router.post("/create", upload.single("logo"), invoiceController.createInvoice);
router.get("/", invoiceController.getInvoices);
router.get("/:id", invoiceController.getInvoiceById);
router.get("/:id/download", invoiceController.downloadInvoice);
router.put("/:id", invoiceController.updateInvoice);
router.delete("/:id", invoiceController.deleteInvoice);

module.exports = router;
