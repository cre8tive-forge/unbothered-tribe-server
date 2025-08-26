import express from "express";
import axios from "axios";
import { Review } from "../models/reviews.js";
import mongoose from "mongoose";

const router = express.Router();

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
    const reviews = await Review.create({
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

router.post("/fetch", async (req, res) => {
  try {
    const { userId } = req.body;
    console.log("Fetching reviews for:", userId);

    if (!userId) {
      return res
        .status(400)
        .json({ error: true, message: "UserId is required" });
    }

    const reviews = await Review.find({
      userId: new mongoose.Types.ObjectId(userId),
    });

    return res.status(200).json({
      error: false,
      reviews,
      message: reviews.length ? "Reviews found" : "No reviews for this user",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: true, message: "Failed to fetch reviews" });
  }
});

router.get("/last-updated", async (req, res) => {
  try {
    const latest = await Review.findOne().sort({ createdAt: -1 });
    res.json({ lastUpdated: latest?.createdAt?.getTime() || Date.now() });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

export default router;
