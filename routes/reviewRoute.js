import express from "express";
import axios from "axios";
import { Review } from "../models/reviews.js";
import mongoose from "mongoose";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();

router.post("/store", async (req, res) => {
  const {
    fullname,
    email,
    message,
    reviewType,
    property,
    agent,
    rating,
    user,
  } = req.body;
  console.log(req.body);
  try {
    const ipAddress = req.ip;
    const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
    const data = await response.json();

    const country = data.country ? data.country : "Unknown";
    const reviews = await Review.create({
      fullname,
      email,
      message,
      reviewType,
      property,
      agent,
      rating,
      user,
      country,
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

router.get("/fetch/user", verifyToken, async (req, res) => {
  const currentUser = req.user.id;
  try {
    const reviews = await Review.find({ user: currentUser }).populate(
      "property",
      "title price images"
    );
    res.status(200).json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch reviews.",
    });
  }
});

router.get("/last-updated/user", verifyToken, async (req, res) => {
  const currentUser = req.user.id;
  try {
    const reviews = await Review.find({ user: currentUser }).sort({
      createdAt: -1,
    });
    res.json({ lastUpdated: reviews?.createdAt?.getTime() || Date.now() });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

export default router;
