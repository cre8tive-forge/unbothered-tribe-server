// Backend route
import express from "express";
import Flutterwave from "flutterwave-node-v3";
import { User } from "../models/users.js";
import { Transaction } from "../models/transactions.js";
import { Subscription } from "../models/subscriptions.js";
import { Timestamp } from "../models/timestamps.js";

const router = express.Router();

const flw = new Flutterwave(
  process.env.FLUTTERWAVE_PUBLIC_KEY,
  process.env.FLUTTERWAVE_SECRET_KEY
);

router.post("/process-payment", async (req, res) => {
  const { transactionId, amount, currency, email, plan, reference, status } =
    req.body;

  if (
    !transactionId ||
    !amount ||
    !currency ||
    !email ||
    !plan ||
    !reference ||
    !status
  ) {
    return res
      .status(400)
      .json({ error: true, message: "Missing transaction details." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: true, message: "User not found." });
    }

    const transaction = await Transaction.findOneAndUpdate(
      { reference: reference },
      {
        userId: user._id,
        amount: amount,
        currency: currency,
        status: status,
        plan: plan,
        transactionId: transactionId,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await Timestamp.findOneAndUpdate(
      { type: "transaction" },
      { $set: { updatedAt: Date.now() } },
      { new: true, upsert: true }
    );

    const verificationResponse = await flw.Transaction.verify({
      id: transactionId,
    });
    const verifiedData = verificationResponse.data;

    if (
      verifiedData.status === "successful" ||
      verifiedData.status === "completed"
    ) {
      await Transaction.findOneAndUpdate(
        { reference: reference },
        {
          status: verifiedData.status,
          amount: verifiedData.amount,
        }
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

      await Subscription.updateMany(
        { userId: user._id, status: "Active" },
        { status: "Expired" }
      );

      const newSubscription = await Subscription.create({
        userId: user._id,
        plan: plan,
        status: "Active",
        expiryDate,
      });

      user.subscription = newSubscription._id;
      user.subscribed = true;
      user.listingLimit = listingLimit;
      await user.save();

      await Timestamp.updateMany(
        {
          type: {
            $in: ["user", "subscription", "transaction"],
          },
        },
        { $set: { updatedAt: Date.now() } }
      );

      return res.status(200).json({
        error: false,
        message: "Payment successful! Your subscription is now active.",
      });
    } else {
      await Transaction.findOneAndUpdate(
        { reference: reference },
        { status: verifiedData.status }
      );
      await Timestamp.findOneAndUpdate(
        { type: "transaction" },
        { $set: { updatedAt: Date.now() } },
        { new: true, upsert: true }
      );

      return res.status(400).json({
        error: true,
        message: "Payment failed during verification. Please try again.",
      });
    }
  } catch (error) {
    console.error("Backend error:", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal server error." });
  }
});

export default router;
