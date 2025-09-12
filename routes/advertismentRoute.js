import express from "express";
import axios from "axios";
import Flutterwave from "flutterwave-node-v3";
import { upload, uploadToCloudinary } from "../resources/multer.js";
import verifyToken from "../middleware/verifyToken.js";
import { Timestamp } from "../models/timestamps.js";
import { Advertisment } from "../models/advertisments.js";
import mongoose from "mongoose";
import { Transaction } from "../models/transactions.js";
const router = express.Router();
const flw = new Flutterwave(
  process.env.FLUTTERWAVE_PUBLIC_KEY,
  process.env.FLUTTERWAVE_SECRET_KEY
);
router.post("/store", upload.single("image"), async (req, res) => {
  try {
    const {
      fullname,
      company,
      email,
      number,
      link,
      adType,
      information,
      captchaToken,
    } = req.body;
    const imageUrl = await uploadToCloudinary(req.file.buffer);
    if (!imageUrl) {
      return res
        .status(500)
        .json({ error: true, message: "Failed to upload image." });
    }
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const captchaResponse = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`
    );
    const captchaData = captchaResponse.data;
    const ipAddress = req.ip;
    const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
    const data = await response.json();

    if (!captchaData.success) {
      return res.status(401).json({
        error: true,
        message: "Recaptcha verification failed. Please try again",
      });
    }
    const country = data.country ? data.country : "Unknown";

    await Advertisment.create({
      fullname,
      company,
      email,
      number,
      country,
      link,
      adType,
      information,
      image: imageUrl,
    });

    await Timestamp.findOneAndUpdate(
      { type: "advertisment" },
      { $set: { updatedAt: Date.now() } },
      {
        new: true,
        upsert: true,
      }
    );

    return res.status(201).json({
      error: false,
      message: "Ad upload successful",
    });
  } catch (err) {
    console.error("Error processing ad upload:", err);
    res.status(500).json({
      error: true,
      message: "Unable to process your request. Please try again.",
      details: err.message,
    });
  }
});
router.get("/fetch", verifyToken, async (req, res) => {
  try {
    const advertisments = await Advertisment.find().sort({ createdAt: -1 });
    res.status(200).json(advertisments);
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Failed to fetch advertisments.",
    });
  }
});
router.post("/delete", verifyToken, async (req, res) => {
  try {
    const { advertismentId } = req.body;
    const advertismentToDelete = await Advertisment.findById(advertismentId);
    if (!advertismentToDelete) {
      return res
        .status(404)
        .json({ error: true, message: "Advertisment record not found." });
    }
    const publicIds = advertismentToDelete.images.map((img) => img.public_id);
    await Promise.all(publicIds.map((id) => cloudinary.uploader.destroy(id)));
    await Advertisment.findByIdAndDelete(advertismentId);
    await Timestamp.findOneAndUpdate(
      { type: "advertisment" },
      { updatedAt: Date.now() },
      { new: true }
    );
    const advertisments = await Advertisment.find().sort({ createdAt: -1 });
    res.status(200).json({
      error: false,
      message: "Advertisment record deleted successfully.",
      advertisments,
      lastUpdated: Date.now(),
    });
  } catch (err) {
    console.error("Error deleting advertisment:", err);
    res.status(500).json({
      error: true,
      message: "Unable to delete advertisment. Please try again.",
      details: err.message,
    });
  }
});
router.put("/status", verifyToken, async (req, res) => {
  try {
    const { advertismentId, status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(advertismentId)) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid advertisment ID." });
    }
    const adexists = await Advertisment.findById(advertismentId);
    if (!adexists) {
      return res
        .status(404)
        .json({ error: true, message: "Advertisment not found." });
    }
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        error: true,
        message: "Not authorized to update advertisment status.",
      });
    }
    const advertisments = await Advertisment.findByIdAndUpdate(
      advertismentId,
      { status: status },
      { new: true }
    ).sort({ createdAt: -1 });

    await Timestamp.findOneAndUpdate(
      { type: "advertisment" },
      { updatedAt: Date.now() },
      { new: true }
    );
    return res.status(200).json({
      error: false,
      message: "Advertisment status updated successfully",
      advertisments,
      lastUpdated: Date.now(),
    });
  } catch (err) {
    console.error("Error updating advertisment status:", err);
    res.status(500).json({
      error: true,
      message: "Unable to update advertisment status. Please try again.",
      details: err.message,
    });
  }
});
router.post("/process-payment", async (req, res) => {
  const { transactionId, plan, email } = req.body;

  if (!transactionId || !plan || !email) {
    return res
      .status(400)
      .json({ error: true, message: "Missing required details." });
  }

  try {
    const verificationResponse = await flw.Transaction.verify({
      id: transactionId,
    });
    const verifiedData = verificationResponse.data;

    if (
      verifiedData.status === "successful" ||
      verifiedData.status === "completed"
    ) {
      await Transaction.findOneAndUpdate(
        { transactionId: transactionId },
        {
          amount: verifiedData.amount,
          currency: verifiedData.currency,
          status: verifiedData.status,
          plan: plan,
          reference: verifiedData.tx_ref,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      await Timestamp.findOneAndUpdate(
        { type: "transaction" },
        { $set: { updatedAt: Date.now() } },
        {
          new: true,
          upsert: true,
        }
      );
      return res.status(200).json({
        error: false,
        message: "Payment completed successfully",
      });
    } else {
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
export default router;
