import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import { Transaction } from "../models/transactions.js";
import { User } from "../models/users.js";
import { Timestamp } from "../models/timestamps.js";
const router = express.Router();
router.get("/fetch/agent", verifyToken, async (req, res) => {
  const currentUserId = req.user.id;
  try {
    const transactions = await Transaction.find({ userId: currentUserId }).sort(
      {
        createdAt: -1,
      }
    );
    res.status(200).json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch reviews.",
    });
  }
});
router.get("/fetch", verifyToken, async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .sort({
        createdAt: -1,
      })
      .populate("userId", "firstname _id profilePhoto");

    res.status(200).json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch subscriptions.",
    });
  }
});
router.post("/delete", verifyToken, async (req, res) => {
  const { transactionId } = req.body;
  try {
    const transactionToDelete = await Transaction.findByIdAndDelete(
      transactionId
    );
    if (!transactionToDelete) {
      return res.status(404).json({
        error: true,
        message: "The requested transaction could not be found.",
      });
    }
    await Timestamp.findOneAndUpdate(
      { type: "transaction" },
      { updatedAt: Date.now() },
      { new: true }
    );
    const transactions = await Transaction.find().sort({ createdAt: -1 });
    res.status(200).json({
      error: false,
      transactions,
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
