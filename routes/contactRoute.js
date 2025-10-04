import express from "express";
import { Contact } from "../models/contacts.js";
const router = express.Router();
import axios from "axios";
import verifyToken from "../middleware/verifyToken.js";
import { Timestamp } from "../models/timestamps.js";
import { sendEmail } from "../config/zohoMailer.js";

router.post("/store", async (req, res) => {
  const { name, subject, email, message, captchaToken } = req.body;

  try {
    const ipAddress = req.ip;
    const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
    const data = await response.json();

    const country = data.country ? data.country : "Unknown";
    await Contact.create({
      name,
      email,
      subject,
      message,
      country,
    });
    await sendEmail({
      to: "business.cre8tiveforge@gmail.com",
      subject: subject,
      html: message.trim(),
    });
    await Timestamp.findOneAndUpdate(
      { type: "contact" },
      { $set: { updatedAt: Date.now() } },
      {
        new: true,
        upsert: true,
      }
    );
    return res.status(200).json({
      error: false,
      message:
        "Your message was sent successfully. We'll get back to you soon.",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      error: true,
      message: "Unable to send your message. Please try again",
    });
  }
});
router.get("/fetch", verifyToken, async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json(contacts);
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Failed to fetch contacts.",
    });
  }
});
router.post("/delete", verifyToken, async (req, res) => {
  const { contactId } = req.body;
  try {
    const contactToDelete = await Contact.findByIdAndDelete(contactId);
    if (!contactToDelete) {
      return res.status(404).json({
        error: true,
        message: "The requested contact could not be found.",
      });
    }
    await Timestamp.findOneAndUpdate(
      { type: "contact" },
      { updatedAt: Date.now() },
      { new: true }
    );
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json({
      error: false,
      contacts,
      lastUpdated: Date.now(),
    });
  } catch (error) {
    console.error(`Contact delete error:`, error);
    res.status(500).json({
      message: "Unable to delete contact. Please try again later.",
      error: error.message,
    });
  }
});
router.post("/mark-read", verifyToken, async (req, res) => {
  const { contactId } = req.body;
  try {
    const contacts = await Contact.findByIdAndUpdate(
      contactId,
      { isRead: true },
      { new: true }
    );

    if (!contacts) {
      return res.status(404).json({
        error: true,
        message: "The requested contact could not be found.",
      });
    }
    await Timestamp.findOneAndUpdate(
      { type: "contact" },
      { updatedAt: Date.now() },
      { new: true }
    );

    res.status(200).json({
      error: false,
      message: "Contact message marked as read.",
      lastUpdated: Date.now(),
      contacts,
    });
  } catch (error) {
    console.error("Failed to mark contact message as read:", error);
    res.status(500).json({
      error: true,
      message: "An unexpected error occurred on the server.",
    });
  }
});

export default router;
