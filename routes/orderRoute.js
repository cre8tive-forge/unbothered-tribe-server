import express, { json } from "express";
import axios from "axios";
import { Order } from "../models/order.js";
import mongoose from "mongoose";
import { Timestamp } from "../models/timestamps.js";
import verifyToken from "../middleware/verifyToken.js";
import { User } from "../models/users.js";

const router = express.Router();
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const verifyPaystackTransaction = async (reference) => {
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw new Error(`Paystack verification failed: ${error.message}`);
  }
};

router.post("/process", async (req, res) => {
  try {
    const { order, checkoutInputs, transactionId, reference, userId } =
      req.body;

    if (!order || !transactionId || !reference) {
      return res.status(400).json({
        error: true,
        message:
          "Order, checkout details and transaction reference are required.",
      });
    }

    const response = await verifyPaystackTransaction(reference);

    if (!response.status || !response.data) {
      return res.status(400).json({
        error: true,
        message: "Payment verification failed. Invalid response from Paystack.",
      });
    }

    const data = response.data;

    if (data.status !== "success") {
      return res.status(400).json({
        error: true,
        message: "Payment was not successful. Please try again.",
        paymentStatus: data.status,
      });
    }

    const amount = data.amount / 100;

    const newOrder = new Order({
      user: userId || null,
      items: order.map((item) => ({
        product: item._id,
        name: item.name,
        price: item.salePrice,
        images: JSON.stringify(item.images),
        quantity: item.quantity || 1,
      })),
      deliveryDetails: checkoutInputs,
      payment: {
        transactionId,
        reference,
        status: "success",
        amount,
        currency: data.currency,
        paidAt: data.paid_at,
        method: data.channel,
      },
    });

    await newOrder.save();
    await Timestamp.findOneAndUpdate(
      { type: "order" },
      { $set: { updatedAt: Date.now() } },
      {
        new: true,
        upsert: true,
      }
    );
    res.status(201).json({
      success: true,
      message: "Order placed successfully. Redirecting....",
      orderId: newOrder._id,
    });
  } catch (err) {
    console.error("Error processing order:", err);
    res.status(500).json({
      error: true,
      message: "Unable to process your order. Please try again.",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});
router.post("/verify", async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid order ID." });
    }
    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(401)
        .json({ error: true, message: "Order record not found" });
    }
    res.status(200).json(order);
  } catch (error) {
    console.error("Error processing order:", error);
    res.status(500).json({
      error: true,
      message: "Unable to process your order. Please try again.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});
router.get("/fetch/user", verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const orders = await Order.find({
      user: userId,
    }).sort({
      createdAt: -1,
    });
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Failed to fetch orders.",
    });
  }
});
router.post("/cancel", verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const { orderId, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        error: true,
        message: "Invalid order ID.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: true,
        message: "User not found.",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        error: true,
        message: "Order not found.",
      });
    }

    const validStatuses = ["processing", "shipped", "delivered", "cancelled"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: true,
        message:
          "Invalid status. Must be one of:  shipped, delivered, or cancelled.",
      });
    }

    if (status === "cancelled") {
      if (user.cancellation < 1) {
        return res.status(400).json({
          error: true,
          message:
            "You have no order cancellations left for this month. This order cannot be cancelled.",
        });
      }

      await User.findByIdAndUpdate(
        { _id: userId, cancellation: { $gt: 0 } },
        { $inc: { cancellation: -1 } }
      );
    }

    await Timestamp.updateMany(
      { type: { $in: ["order", "user"] } },
      { $set: { updatedAt: Date.now() } }
    );

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { orderStatus: status },
      { new: true }
    );

    res.status(200).json({
      error: false,
      message: `Order status updated to '${status}' successfully.`,
      order: updatedOrder,
    });
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Unable to update order status. Please try again later.",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

export default router;
