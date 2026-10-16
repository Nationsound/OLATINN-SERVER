const express = require("express");

const orderControllers = require("../controllers/orderControllers");

const router = express.Router();

/*
 * ========================================
 * Create order
 *
 * Guest + authenticated user
 * ========================================
 */

router.post(
  "/create",
  orderControllers.createOrder
);

/*
 * ========================================
 * Get single order
 * ========================================
 */

router.get(
  "/:orderNumber",
  orderControllers.getOrderByNumber
);

/*
 * ========================================
 * Update pending order
 * ========================================
 */

router.put(
  "/:orderNumber",
  orderControllers.updateOrder
);

/*
 * ========================================
 * Delete / cancel order
 * ========================================
 */

router.delete(
  "/:orderNumber",
  orderControllers.deleteOrder
);

module.exports = router;