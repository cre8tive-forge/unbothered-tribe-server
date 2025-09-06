import express from "express";
import Flutterwave from "flutterwave-node-v3";
import { User } from "../models/users.js";
import { Transaction } from "../models/transactions.js";
import { Subscription } from "../models/subscriptions.js";
import { Timestamp } from "../models/timestamps.js";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();

const flw = new Flutterwave(
  process.env.FLUTTERWAVE_PUBLIC_KEY,
  process.env.FLUTTERWAVE_SECRET_KEY
);

router.post("/process-payment", async (req, res) => {
  const { transactionId, plan, email } = req.body;

  const expectedAmounts = {
    Basic: 1000,
    Premium: 5000,
    Professional: 10000,
  };

  if (!transactionId || !plan || !email) {
    return res
      .status(400)
      .json({ error: true, message: "Missing required details." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: true, message: "User not found." });
    }

    const verificationResponse = await flw.Transaction.verify({
      id: transactionId,
    });
    const verifiedData = verificationResponse.data;

    if (
      (verifiedData.status === "successful" ||
        verifiedData.status === "completed") &&
      verifiedData.amount >= expectedAmounts[plan]
    ) {
      const transaction = await Transaction.findOneAndUpdate(
        { transactionId: transactionId },
        {
          userId: user._id,
          amount: verifiedData.amount,
          currency: verifiedData.currency,
          status: verifiedData.status,
          plan: plan,
          reference: verifiedData.tx_ref,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      await Subscription.updateMany(
        { userId: user._id, status: "Active" },
        { status: "Expired" }
      );

      const subscriptionDurationInDays = 30;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + subscriptionDurationInDays);

      let listingLimit;
      switch (plan) {
        case "Basic":
          listingLimit = 10;
          break;
        case "Premium":
          listingLimit = 50;
          break;
        case "Professional":
          listingLimit = Infinity;
          break;
        default:
          listingLimit = 1;
      }

      const newSubscription = await Subscription.create({
        userId: user._id,
        plan: plan,
        status: "Active",
        expiryDate,
        transaction: transaction._id,
      });

      user.subscription = newSubscription._id;
      user.subscribed = true;
      user.listingLimit = listingLimit;
      await user.save();

      await Timestamp.updateMany(
        { type: { $in: ["user", "subscription", "transaction"] } },
        { $set: { updatedAt: Date.now() } }
      );

      return res.status(200).json({
        error: false,
        message: "Payment successful! Your subscription is now active.",
      });
    } else {
      // Payment failed or amount mismatch
      await Transaction.findOneAndUpdate(
        { transactionId: transactionId },
        { status: "failed" }, // Default to failed for security
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      await Timestamp.findOneAndUpdate(
        { type: "transaction" },
        { $set: { updatedAt: Date.now() } },
        { new: true, upsert: true }
      );

      return res.status(400).json({
        error: true,
        message: "Payment failed. Please try again.",
      });
    }
  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({
      error: true,
      message: "An internal server error occurred.",
    });
  }
});

router.post("/free-plan", verifyToken, async (req, res) => {

});

export default router;
