import express from "express";
import Flutterwave from "flutterwave-node-v3";
import { User } from "../models/users.js";
import { Transaction } from "../models/transactions.js";
import { Subscription } from "../models/subscriptions.js";
import { Timestamp } from "../models/timestamps.js";
import verifyToken from "../middleware/verifyToken.js";
import { nanoid } from "nanoid";
const router = express.Router();

const flw = new Flutterwave(
  process.env.FLUTTERWAVE_PUBLIC_KEY,
  process.env.FLUTTERWAVE_SECRET_KEY
);

router.post("/process-payment", verifyToken, async (req, res) => {
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
    const user = await User.findOneAndUpdate(
      { email },
      { plan: plan },
      { new: true }
    );
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
        currency: verifiedData.currency,
        amount: verifiedData.amount,
        reference: verifiedData.tx_ref,
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
      await Transaction.findOneAndUpdate(
        { transactionId: transactionId },
        { status: "failed" },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      await Timestamp.updateMany(
        { type: { $in: ["user", "subscription", "transaction"] } },
        { $set: { updatedAt: Date.now() } },
        { new: true, upsert: true }
      );

      return res.status(400).json({
        error: true,
        message: "Payment failed. Please try again.",
        user,
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
  const { plan, email } = req.body;
  if (!plan || !email) {
    return res
      .status(400)
      .json({ error: true, message: "Missing required details." });
  }
  try {
    const user = await User.findOneAndUpdate(
      { email },
      { plan: plan },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: true, message: "User not found." });
    }

    const freeTransaction = await Transaction.create({
      userId: user._id,
      transactionId: `free-plan-${nanoid()}`,
      amount: 0,
      currency: "N/A",
      reference: `free-plan-${nanoid()}`,
      status: "successful",
      plan: plan,
    });

    await Subscription.updateMany(
      { userId: user._id, status: "Active" },
      { status: "Expired" }
    );

    const subscriptionDurationInDays = 30;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + subscriptionDurationInDays);

    const listingLimit = 10;

    const newSubscription = await Subscription.create({
      userId: user._id,
      plan: plan,
      amount: 0,
      currency: "N/A",
      status: "Active",
      reference: freeTransaction.reference,
      expiryDate,
      transaction: freeTransaction._id,
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
      message: "Subscription to basic plan successful!",
      user,
    });
  } catch (error) {
    console.error("Backend error:", error);
    return res
      .status(500)
      .json({ error: true, message: "An internal server error occurred." });
  }
});

router.get("/fetch", verifyToken, async (req, res) => {
  try {
    const subscriptions = await Subscription.find()
      .sort({
        createdAt: -1,
      })
      .populate("userId", "firstname middlename lastname profilePhoto");
    res.status(200).json(subscriptions);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch subscriptions.",
    });
  }
});

router.post("/delete", verifyToken, async (req, res) => {
  const { subscriptionId } = req.body;
  try {
    const subscriptionToDelete = await Subscription.findByIdAndDelete(
      subscriptionId
    );
    if (!subscriptionToDelete) {
      return res.status(404).json({
        error: true,
        message: "The requested subscription could not be found.",
      });
    }
    await Timestamp.findOneAndUpdate(
      { type: "subscription" },
      { updatedAt: Date.now() },
      { new: true }
    );
    const subscriptions = await Subscription.find().sort({ createdAt: -1 });
    res.status(200).json({
      error: false,
      subscriptions,
      lastUpdated: Date.now(),
    });
  } catch (error) {
    console.error(`Transaction delete error:`, error);
    res.status(500).json({
      message: "Unable to delete transaction. Please try again later.",
      error: error.message,
    });
  }
});
export default router;
