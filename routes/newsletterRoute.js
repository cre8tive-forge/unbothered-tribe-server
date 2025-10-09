import { Newsletter } from "../models/newsletter.js";
import express from "express";
import { Timestamp } from "../models/timestamps.js";
import {
  adminNewslettermail,
  newslettermail,
} from "../config/emailTemplates.js";
import { sendEmail } from "../config/zohoMailer.js";
import verifyToken from "../middleware/verifyToken.js";
import mongoose from "mongoose";
const router = express.Router();

router.post("/store", async (req, res) => {
  try {
    const { email } = req.body;
    const emailExists = await Newsletter.findOne({ email: email });
    if (emailExists) {
      return res.status(409).json({
        error: true,
        message: "This email is already subscribed to the newsletter.",
      });
    }
    const ipAddress = req.ip;
    const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
    const data = await response.json();
    const country = data.country || "Unknown";
    const city = data.city || "Unknown";

    Newsletter.create({ email, country, city });
    await Timestamp.findOneAndUpdate(
      { type: "newsletter" },
      { $set: { updatedAt: Date.now() } },
      {
        new: true,
        upsert: true,
      }
    );

    await sendEmail({
      to: email,
      subject: "🎉 Welcome to the Unbothered Tribe",
      html: newslettermail.trim(),
    });

    await sendEmail({
      to: "business.cre8tiveforge@gmail.com",
      subject: "New newsletter subscription on Unbothered Tribe",
      html: adminNewslettermail.trim().replace(/{{EMAIL}}/g, email),
    });

    return res.status(201).json({
      error: false,
      message: "You have successfully subscribed to the newsletter.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: true,
      message:
        "An error occurred while saving your subscription. Please try again later.",
    });
  }
});
router.get("/fetch", verifyToken, async (req, res) => {
  const user = req.user;
  if (user.role !== "Admin") {
    return res.status(400).json({
      error: true,
      message: "You are not authorized to access this route",
    });
  }
  const newsletters = await Newsletter.find().sort({ createdAt: -1 });
  res.status(200).json(newsletters);
});
router.post("/delete", verifyToken, async (req, res) => {
  const { newsletterId } = req.body;
  if (req.user.role !== "Admin") {
    return res.status(400).json({
      error: true,
      message: "You are not authorized to perform this action",
    });
  }
  if (!mongoose.Types.ObjectId.isValid(newsletterId)) {
    return res.status(400).json({
      error: true,
      message: "Invalid newsletter ID.",
    });
  }

  try {
    const recordToDelete = await Newsletter.findById(newsletterId);
    if (!recordToDelete) {
      return res.status(404).json({
        error: true,
        message: "Newsletter record not found.",
      });
    }

    await Newsletter.findByIdAndDelete(newsletterId);

    await Timestamp.updateMany(
      { type: { $in: ["Newsletter"] } },
      { $set: { updatedAt: new Date() } }
    );

    const newsletters = await Newsletter.find().sort({ createdAt: -1 });
    const lastUpdated = Date.now();

    res.status(200).json({
      error: false,
      message: "Newsletter deleted successfully.",
      newsletters,
      lastUpdated,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      error: true,
      message: "Failed to delete newsletter.",
      details: err.message,
    });
  }
});
export default router;
