import express from "express";
import { Review } from "../models/reviews.js";
import verifyToken from "../middleware/verifyToken.js";
import { Property } from "../models/property.js";
import { Timestamp } from "../models/timestamps.js";

const router = express.Router();

router.post("/store", async (req, res) => {
  try {
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
    const reviewExists = await Review.findOne({ property, user });

    if (reviewExists) {
      return res.status(400).json({
        error: true,
        message: "You have already left a review for this property.",
      });
    }

    const ipAddress = req.ip;
    const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
    const data = await response.json();

    const country = data.country || "Unknown";

    await Review.create({
      fullname,
      email,
      message,
      reviewType,
      property,
      agent,
      rating: Number(rating),
      user,
      country,
    });

    const reviews = await Review.find({ property });

    const avg =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    await Property.findByIdAndUpdate(property, {
      averageRating: avg,
      ratingCount: reviews.length,
    });

    await Timestamp.findOneAndUpdate(
      { type: "review" },
      { $set: { updatedAt: Date.now() } },
      {
        new: true,
        upsert: true,
      }
    );

    return res.status(200).json({
      error: false,
      message: "Review submitted successfully",
      averageRating: avg,
      ratingCount: reviews.length,
    });
  } catch (err) {
    console.log(err);
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
      "title price images _id"
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

export default router;
