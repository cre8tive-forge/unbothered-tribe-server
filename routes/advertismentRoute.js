import express from "express";
import axios from "axios";
import Flutterwave from "flutterwave-node-v3";
import { upload, uploadToCloudinary } from "../resources/multer.js";
import verifyToken from "../middleware/verifyToken.js";
import { Timestamp } from "../models/timestamps.js";
import { Advertisment } from "../models/advertisments.js";
import mongoose from "mongoose";
import { Transaction } from "../models/transactions.js";
import {
  adSubmissionMail,
  mailOptions,
  transporter,
} from "../config/nodemailer.js";
import cloudinary from "../config/cloudinary.js";
const router = express.Router();
const flw = new Flutterwave(
  process.env.FLUTTERWAVE_PUBLIC_KEY,
  process.env.FLUTTERWAVE_SECRET_KEY
);
router.post(
  "/store",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  async (req, res) => {
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
        duration,
      } = req.body;
      const imageFile = req.files.image?.[0];
      const bannerFile = req.files.banner?.[0];
      if (!imageFile || !bannerFile) {
        return res.status(400).json({
          error: true,
          message: "Both the payment proof and banner image are required.",
        });
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
      const imageUrl = await uploadToCloudinary(imageFile.buffer);
      const bannerUrl = await uploadToCloudinary(bannerFile.buffer);

      if (!imageUrl || !bannerUrl) {
        return res.status(500).json({
          error: true,
          message: "Failed to upload one or more images.",
        });
      }
      await Advertisment.create({
        fullname,
        company,
        email,
        number,
        country,
        link,
        adType,
        information,
        duration,
        image: imageUrl,
        banner: bannerUrl,
      });
      await transporter.sendMail({
        ...mailOptions,
        to: email,
        subject: "📢 Your Advertisement Has Been Submitted",
        html: adSubmissionMail
          .replace(/{{FULLNAME}}/g, fullname || "User")
          .replace(/{{COMPANY}}/g, company || "N/A")
          .replace(/{{EMAIL}}/g, email || "N/A")
          .replace(/{{NUMBER}}/g, number || "N/A")
          .replace(/{{ADTYPE}}/g, adType || "General")
          .replace(/{{LINK}}/g, link || "No link provided")
          .replace(/{{INFORMATION}}/g, information || "No details provided"),
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
  }
);
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

router.get("/fetch/:id", async (req, res) => {
  try {
    const ads = await Advertisment.find({
      status: "active",
      position: req.params.id,
    }).sort({ createdAt: -1 });
    return res.status(200).json(ads);
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
    await cloudinary.uploader.destroy(advertismentToDelete.image.public_id);
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
router.post("/activate", verifyToken, async (req, res) => {
  try {
    const { advertismentId, position } = req.body;
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
    const positionTaken = await Advertisment.findOne({
      position: position,
      status: "active",
    });

    if (positionTaken) {
      return res.status(409).json({
        error: true,
        message: "Advertisment placement position already taken.",
      });
    }
    let durationInDays;
    switch (adexists.duration) {
      case "1 Month":
        durationInDays = 30;
        break;
      case "2 Months":
        durationInDays = 60;
        break;
      case "3 Months":
        durationInDays = 90;
        break;
      default:
        durationInDays = 30;
    }
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + durationInDays);

    const advertisments = await Advertisment.findByIdAndUpdate(
      advertismentId,
      {
        position: position,
        status: "active",
        startDate: Date.now(),
        expiryDate: expiryDate,
      },
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
