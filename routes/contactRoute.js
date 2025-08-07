import express from "express";
import { Contacts } from "../models/contacts.js";
const router = express.Router();
import axios from "axios";

router.post("/submit", async (req, res) => {
  const { firstname, lastname, email, message, captchaToken } = req.body;

  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const captchaResponse = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`
    );

    const ipAddress = req.ip;
    const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
    const data = await response.json();

    const country = data.country ? data.country : "Unknown";
    const contact = await Contacts.create({
      firstname: firstname,
      lastname: lastname,
      email: email,
      message: message,
      country: country,
    });
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
    const contacts = await Contacts.find();
    res.status(200).json(contacts);
  } catch (err) {
    res
      .status(500)
      .json({ error: true, message: "Failed to fetch contact messages" });
  }
});

export default router;
