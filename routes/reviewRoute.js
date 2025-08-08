import express from "express";
const router = express.Router();
import axios from "axios";
import { Reviews } from "../models/reviews.js";

router.post("/store", async (req, res) => {
  const { fullname, occupation, message, captchaToken } = req.body;
console.log({ fullname });
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const captchaResponse = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`
    );

    const ipAddress = req.ip;
    const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
    const data = await response.json();

    const country = data.country ? data.country : "Unknown";
    const reviews = await Reviews.create({
      fullname: fullname,
      occupation: occupation,
      message: message,
      country: country,
    });
    return res.status(200).json({
      error: false,
      message: "Review submitted successfully",
    });
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Unable to submit your review. Please try again",
    });
  }
});

router.get("/fetch", async (req, res) => {
  try {
    const reviews = await Reviews.find();
    res.status(200).json(reviews);
  } catch (err) {
    res
      .status(500)
      .json({ error: true, message: "Failed to fetch reviews" });
  }
});

export default router;
