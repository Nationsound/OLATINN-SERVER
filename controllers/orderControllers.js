const mongoose = require("mongoose");

const Order = require("../models/orderSchema");
const Product = require("../models/adminSchema");
const Store = require("../models/storeSchema");

/*
 * ========================================
 * Helpers
 * ========================================
 */

const getUserId = (req) => {
  return (
    req.user?._id ||
    req.user?.id ||
    req.userId ||
    null
  );
};

const cleanString = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidPhone = (phone) => {
  return /^[0-9+\-\s()]{7,20}$/.test(phone);
};

/*
 * ========================================
 * Create Store-Specific Order
 *
 * Guest + Registered users
 * ========================================
 */

const createOrder = async (req, res) => {
  try {
    const {
      storeId,
      items,
      customer,
      deliveryFee = 0,
    } = req.body;

    /*
     * A checkout must belong to exactly one store.
     */

    if (
      !storeId ||
      !mongoose.Types.ObjectId.isValid(storeId)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid store is required.",
      });
    }

    /*
     * Verify the store exists.
     */

    const store = await Store.findById(storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found.",
      });
    }

    /*
     * Validate cart.
     */

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty.",
      });
    }

    /*
     * Validate customer.
     */

    if (!customer || typeof customer !== "object") {
      return res.status(400).json({
        success: false,
        message: "Customer details are required.",
      });
    }

    const fullName = cleanString(
      customer.fullName
    );

    const email = cleanString(
      customer.email
    ).toLowerCase();

    const phone = cleanString(
      customer.phone
    );

    const address = cleanString(
      customer.address
    );

    const city = cleanString(
      customer.city
    );

    const state = cleanString(
      customer.state
    );

    const country = cleanString(
      customer.country
    );

    const deliveryNotes = cleanString(
      customer.deliveryNotes
    );

    if (!fullName || fullName.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid full name.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid phone number.",
      });
    }

    if (!address || address.length < 5) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid home or delivery address.",
      });
    }

    if (!city) {
      return res.status(400).json({
        success: false,
        message: "City is required.",
      });
    }

    if (!state) {
      return res.status(400).json({
        success: false,
        message: "State is required.",
      });
    }

    if (!country) {
      return res.status(400).json({
        success: false,
        message: "Country is required.",
      });
    }

    const numericDeliveryFee =
      Number(deliveryFee);

    if (
      !Number.isFinite(numericDeliveryFee) ||
      numericDeliveryFee < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid delivery fee.",
      });
    }

    /*
     * ========================================
     * Validate requested products
     * ========================================
     */

    const requestedItems = [];

    for (const item of items) {
      if (
        !item ||
        !item.productId ||
        !mongoose.Types.ObjectId.isValid(
          item.productId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid cart item.",
        });
      }

      const quantity = Number(
        item.quantity
      );

      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Product quantity must be between 1 and 100.",
        });
      }

      requestedItems.push({
        productId: item.productId,
        quantity,
      });
    }

    /*
     * Fetch products from MongoDB.
     *
     * Prices, merchant and availability are
     * NEVER trusted from the browser.
     */

    const productIds =
      requestedItems.map(
        (item) => item.productId
      );

    const products = await Product.find({
      _id: {
        $in: productIds,
      },
    });

    if (
      products.length !== productIds.length
    ) {
      return res.status(404).json({
        success: false,
        message:
          "One or more products could not be found.",
      });
    }

    const productMap = new Map();

    products.forEach((product) => {
      productMap.set(
        product._id.toString(),
        product
      );
    });

    const orderItems = [];

    let subtotal = 0;

    let orderCurrency = null;

    for (const requestedItem of requestedItems) {
      const product =
        productMap.get(
          requestedItem.productId.toString()
        );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found.",
        });
      }

      /*
       * Make absolutely sure the product belongs
       * to the store being checked out.
       */

      const productStoreId =
        product.store ||
        product.storeId;

      if (
        !productStoreId ||
        productStoreId.toString() !==
          storeId.toString()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "All products in this checkout must belong to the selected store.",
        });
      }

      /*
       * Product availability.
       */

      if (
        product.isActive === false ||
        product.status === "inactive"
      ) {
        return res.status(400).json({
          success: false,
          message:
            `${product.name} is currently unavailable.`,
        });
      }

      /*
       * Optional stock validation.
       */

      if (
        product.stock !== undefined &&
        product.stock !== null
      ) {
        const stock =
          Number(product.stock);

        if (
          !Number.isFinite(stock) ||
          stock < requestedItem.quantity
        ) {
          return res.status(400).json({
            success: false,
            message:
              `${product.name} does not have enough stock.`,
          });
        }
      }

      const price =
        Number(product.price);

      if (
        !Number.isFinite(price) ||
        price < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `${product.name} has an invalid price.`,
        });
      }

      const currency =
        product.currency || "NGN";

      if (!orderCurrency) {
        orderCurrency = currency;
      }

      if (
        currency !== orderCurrency
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Products with different currencies cannot be combined.",
        });
      }

      const itemSubtotal =
        price * requestedItem.quantity;

      subtotal += itemSubtotal;

      const merchant =
        product.merchant ||
        product.owner ||
        product.user;

      if (!merchant) {
        return res.status(400).json({
          success: false,
          message:
            `${product.name} is not linked to a merchant.`,
        });
      }

      orderItems.push({
        product:
          product._id,

        merchant,

        name:
          product.name,

        quantity:
          requestedItem.quantity,

        priceAtPurchase:
          price,

        currency,

        subtotal:
          itemSubtotal,
      });
    }

    const total =
      subtotal +
      numericDeliveryFee;

    const userId =
      getUserId(req);

    /*
     * Create ONE order for ONE store.
     */

    const order =
      await Order.create({
        user:
          userId || null,

        store:
          store._id,

        customer: {
          fullName,
          email,
          phone,
          address,
          city,
          state,
          country,
          deliveryNotes,
        },

        items:
          orderItems,

        subtotal,

        deliveryFee:
          numericDeliveryFee,

        total,

        currency:
          orderCurrency || "NGN",

        status:
          "pending",

        paymentStatus:
          "pending",

        paymentProvider:
          "manual",
      });

    return res.status(201).json({
      success: true,
      message:
        "Order created successfully.",

      order,
    });
  } catch (error) {
    console.error(
      "Create order error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create your order.",
    });
  }
};

/*
 * ========================================
 * Update Order
 *
 * Customer can update pending order details.
 * ========================================
 */

const updateOrder = async (req, res) => {
  try {
    const {
      orderNumber,
    } = req.params;

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Order number is required.",
      });
    }

    const order =
      await Order.findOne({
        orderNumber:
          orderNumber.trim(),
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message:
          "Order not found.",
      });
    }

    /*
     * Only pending orders can be edited.
     *
     * Once payment/fulfilment begins, the customer
     * should not be able to rewrite the order.
     */

    if (
      order.status !== "pending"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This order can no longer be edited.",
      });
    }

    /*
     * Registered users must own the order.
     */

    const userId =
      getUserId(req);

    if (order.user) {
      if (
        !userId ||
        order.user.toString() !==
          userId.toString()
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You are not authorized to update this order.",
        });
      }
    }

    /*
     * Guest orders use the checkout email as the
     * ownership identifier.
     *
     * The frontend should send the guest email
     * when updating a guest order.
     */

    if (!order.user) {
      const requestEmail =
        cleanString(
          req.body.email
        ).toLowerCase();

      if (
        !requestEmail ||
        requestEmail !==
          order.customer.email
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Guest order verification failed.",
        });
      }
    }

    const customer =
      req.body.customer;

    if (
      !customer ||
      typeof customer !== "object"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Customer details are required.",
      });
    }

    const fullName =
      cleanString(
        customer.fullName
      );

    const email =
      cleanString(
        customer.email
      ).toLowerCase();

    const phone =
      cleanString(
        customer.phone
      );

    const address =
      cleanString(
        customer.address
      );

    const city =
      cleanString(
        customer.city
      );

    const state =
      cleanString(
        customer.state
      );

    const country =
      cleanString(
        customer.country
      );

    const deliveryNotes =
      cleanString(
        customer.deliveryNotes
      );

    if (
      !fullName ||
      fullName.length < 2
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid full name.",
      });
    }

    if (
      !isValidEmail(email)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid email address.",
      });
    }

    if (
      !isValidPhone(phone)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid phone number.",
      });
    }

    if (
      !address ||
      address.length < 5
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid delivery address.",
      });
    }

    if (!city || !state || !country) {
      return res.status(400).json({
        success: false,
        message:
          "City, state and country are required.",
      });
    }

    /*
     * Replace the entire customer snapshot.
     */

    order.customer = {
      fullName,
      email,
      phone,
      address,
      city,
      state,
      country,
      deliveryNotes,
    };

    /*
     * Allow quantity changes while pending.
     *
     * Prices are recalculated from the database.
     */

    if (
      Array.isArray(
        req.body.items
      ) &&
      req.body.items.length > 0
    ) {
      const requestedItems =
        req.body.items;

      const productIds =
        requestedItems.map(
          (item) => item.productId
        );

      for (
        const item of requestedItems
      ) {
        if (
          !item.productId ||
          !mongoose.Types.ObjectId.isValid(
            item.productId
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid product ID.",
          });
        }

        const quantity =
          Number(item.quantity);

        if (
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 100
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid product quantity.",
          });
        }
      }

      const incomingProductIds = requestedItems.map((item) => item.productId);

console.log("========================================");
console.log("ORDER PRODUCT LOOKUP");
console.log("Product IDs received:", incomingProductIds);
console.log(
  "Product ID types:",
  incomingProductIds.map((id) => ({
    id,
    type: typeof id,
    validObjectId: mongoose.Types.ObjectId.isValid(id),
  }))
);
console.log("========================================");

// Convert the incoming string IDs to MongoDB ObjectIds
const objectProductIds = incomingProductIds.map(
  (id) => new mongoose.Types.ObjectId(id)
);

const products = await Product.find({
  _id: {
    $in: objectProductIds,
  },
});

console.log("PRODUCTS FOUND:", products.length);

console.log(
  "PRODUCTS FOUND DATA:",
  products.map((product) => ({
    id: product._id.toString(),
    name: product.name,
    store: product.store?.toString(),
    owner: product.owner?.toString(),
    price: product.price,
    stockQuantity: product.stockQuantity,
    status: product.status,
  }))
);

if (products.length !== productIds.length) {
  const foundIds = products.map((product) =>
    product._id.toString()
  );

  const missingIds = productIds.filter(
    (id) => !foundIds.includes(id)
  );

  console.log("========================================");
  console.log("MISSING PRODUCT IDS:", missingIds);
  console.log("FOUND PRODUCT IDS:", foundIds);
  console.log("========================================");

  return res.status(404).json({
    success: false,
    message: "One or more products could not be found.",
    missingProductIds: missingIds,
    foundProductIds: foundIds,
  });
}

const productMap = new Map();

products.forEach((product) => {
  productMap.set(
    product._id.toString(),
    product
  );
});
      const updatedItems = [];

      let subtotal = 0;

      let currency = null;

      for (
        const item of requestedItems
      ) {
        const product =
          productMap.get(
            item.productId.toString()
          );

        if (!product) {
          return res.status(404).json({
            success: false,
            message:
              "Product not found.",
          });
        }

        const productStore =
          product.store ||
          product.storeId;

        if (
          !productStore ||
          productStore.toString() !==
            order.store.toString()
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Product does not belong to this order's store.",
          });
        }

        if (
          product.isActive === false ||
          product.status === "inactive"
        ) {
          return res.status(400).json({
            success: false,
            message:
              `${product.name} is unavailable.`,
          });
        }

        const price =
          Number(product.price);

        if (
          !Number.isFinite(price) ||
          price < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid product price.",
          });
        }

        const itemCurrency =
          product.currency ||
          "NGN";

        if (!currency) {
          currency =
            itemCurrency;
        }

        if (
          itemCurrency !== currency
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Products with different currencies cannot be combined.",
          });
        }

        const quantity =
          Number(item.quantity);

        const itemSubtotal =
          price * quantity;

        subtotal +=
          itemSubtotal;

        const merchant =
          product.merchant ||
          product.owner ||
          product.user;

        if (!merchant) {
          return res.status(400).json({
            success: false,
            message:
              `${product.name} is not linked to a merchant.`,
          });
        }

        updatedItems.push({
          product:
            product._id,

          merchant,

          name:
            product.name,

          quantity,

          priceAtPurchase:
            price,

          currency:
            itemCurrency,

          subtotal:
            itemSubtotal,
        });
      }

      order.items =
        updatedItems;

      order.subtotal =
        subtotal;

      order.currency =
        currency || order.currency;
    }

    /*
     * Delivery fee can be updated while pending.
     */

    if (
      req.body.deliveryFee !==
      undefined
    ) {
      const newDeliveryFee =
        Number(
          req.body.deliveryFee
        );

      if (
        !Number.isFinite(
          newDeliveryFee
        ) ||
        newDeliveryFee < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid delivery fee.",
        });
      }

      order.deliveryFee =
        newDeliveryFee;
    }

    order.total =
      order.subtotal +
      order.deliveryFee;

    await order.save();

    return res.status(200).json({
      success: true,
      message:
        "Order updated successfully.",
      order,
    });
  } catch (error) {
    console.error(
      "Update order error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update this order.",
    });
  }
};

/*
 * ========================================
 * Delete / Cancel Order
 * ========================================
 *
 * We don't physically delete an order that
 * has entered payment/fulfilment processing.
 *
 * A pending order can be deleted.
 * A later order is cancelled instead.
 * ========================================
 */

const deleteOrder = async (req, res) => {
  try {
    const {
      orderNumber,
    } = req.params;

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Order number is required.",
      });
    }

    const order =
      await Order.findOne({
        orderNumber:
          orderNumber.trim(),
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message:
          "Order not found.",
      });
    }

    const userId =
      getUserId(req);

    /*
     * Registered order ownership.
     */

    if (order.user) {
      if (
        !userId ||
        order.user.toString() !==
          userId.toString()
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You are not authorized to delete this order.",
        });
      }
    }

    /*
     * Guest ownership verification.
     */

    if (!order.user) {
      const requestEmail =
        cleanString(
          req.body.email
        ).toLowerCase();

      if (
        !requestEmail ||
        requestEmail !==
          order.customer.email
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Guest order verification failed.",
        });
      }
    }

    /*
     * A pending unpaid order can be
     * physically removed.
     */

    if (
      order.status === "pending" &&
      order.paymentStatus === "pending"
    ) {
      await Order.deleteOne({
        _id: order._id,
      });

      return res.status(200).json({
        success: true,
        message:
          "Order deleted successfully.",
      });
    }

    /*
     * Once the order has progressed beyond
     * a simple pending checkout, preserve
     * the historical record.
     */

    if (
      order.status !== "cancelled" &&
      order.status !== "completed" &&
      order.status !== "delivered"
    ) {
      order.status =
        "cancelled";

      order.cancelledAt =
        new Date();

      await order.save();

      return res.status(200).json({
        success: true,
        message:
          "Order cancelled successfully.",
        order,
      });
    }

    return res.status(400).json({
      success: false,
      message:
        "This order can no longer be deleted.",
    });
  } catch (error) {
    console.error(
      "Delete order error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to delete this order.",
    });
  }
};

/*
 * ========================================
 * Get Order
 * ========================================
 */

const getOrderByNumber = async (
  req,
  res
) => {
  try {
    const {
      orderNumber,
    } = req.params;

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Order number is required.",
      });
    }

    const order =
      await Order.findOne({
        orderNumber:
          orderNumber.trim(),
      })
        .populate(
          "store",
          "storeName name slug"
        )
        .populate(
          "items.product",
          "name price currency"
        )
        .populate(
          "items.merchant",
          "fullName email"
        );

    if (!order) {
      return res.status(404).json({
        success: false,
        message:
          "Order not found.",
      });
    }

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error(
      "Get order error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve order.",
    });
  }
};

module.exports = {
  createOrder,
  updateOrder,
  deleteOrder,
  getOrderByNumber,
};