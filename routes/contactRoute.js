import express from "express";
import { Contact } from "../models/contacts.js";
const router = express.Router();
import axios from "axios";
import verifyToken from "../middleware/verifyToken.js";

router.post("/store", async (req, res) => {
  const { fullname, number, email, message, captchaToken } = req.body;

  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const captchaResponse = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`
    );

    const ipAddress = req.ip;
    const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
    const data = await response.json();

    const country = data.country ? data.country : "Unknown";
    await Contact.create({
      fullname,
      email,
      number,
      message,
      country,
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
      message: "Contact message sent successfully",
    });
  } catch (err) {
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
    const updatedContact = await Contact.findByIdAndUpdate(
      contactId,
      { isRead: true },
      { new: true }
    );

    if (!updatedContact) {
      return res.status(404).json({
        error: true,
        message: "The requested contact could not be found.",
      });
    }
    await Timestamp.findOneAndUpdate(
      { type: "contac" },
      { updatedAt: Date.now() },
      { new: true }
    );

    res.status(200).json({
      error: false,
      message: "Contact message marked as read.",
      lastUpdated: Date.now(),
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
