import { Newsletter } from "../models/newsletter.js";
import express from "express";
import { Timestamp } from "../models/timestamps.js";
import {
  adminNewslettermail,
  newslettermail,
} from "../config/emailTemplates.js";
import { sendEmail } from "../config/zohoMailer.js";
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
    Newsletter.create({ email });
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
      subject: "🎉 Welcome to the HouseHunter Newsletter",
      html: newslettermail.trim(),
    });
    try {
      await sendEmail({
        to: "info@househunter.ng",
        subject: "New newsletter subscription on Househunter.ng",
        html: adminNewslettermail.trim().replace(/{{EMAIL}}/g, email),
      });
    } catch (emailError) {
      console.error(
        "Welcome email failed to send to admin:",
        emailError.response?.data || emailError.message
      );
    }

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
export default router;
