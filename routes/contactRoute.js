import express from "express";
import { Contact } from "../models/contacts.js";
const router = express.Router();
import axios from "axios";

router.post("/submit", async (req, res) => {
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
      email,number,
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
      message: "Message sent successfully",
    });
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Unable to send your message. Please try again",
    });
  }
});

router.get("/fetch", async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json(contacts);
  } catch (err) {
    res
      .status(500)
      .json({ error: true, message: "Failed to fetch contact messages" });
  }
});

export default router;
