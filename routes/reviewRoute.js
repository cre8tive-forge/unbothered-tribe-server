import express from "express";
import { Review } from "../models/reviews.js";
import verifyToken from "../middleware/verifyToken.js";
import { Property } from "../models/property.js";
import { Timestamp } from "../models/timestamps.js";
import mongoose from "mongoose";

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
    const reviews = await Review.find({
      user: currentUser,
      status: "published",
    }).populate("property", "title price images _id");
    res.status(200).json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch reviews.",
    });
  }
});
router.get("/fetch/admin", verifyToken, async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("property", "title price images _id")
      .populate("agent", "firstname lastname email country _id")
      .populate("user", "firstname lastname email country _id");

    res.status(200).json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch reviews.",
    });
  }
});
router.get("/fetch", async (req, res) => {
  try {
    const reviews = await Review.find({ status: "published" })
      .sort({ createdAt: -1 })
      .limit(6)
      .populate("user", "firstname lastname country profilePhoto role");

    res.status(200).json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch reviews.",
    });
  }
});
router.post("/delete", verifyToken, async (req, res) => {
  const { reviewId } = req.body;
  try {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid review ID." });
    }
    const reviewToDelete = await Review.findByIdAndDelete(reviewId);
    if (!reviewToDelete) {
      return res.status(404).json({
        error: true,
        message: "The requested review could not be found.",
      });
    }
    await Timestamp.findOneAndUpdate(
      { type: "review" },
      { updatedAt: Date.now() },
      { new: true }
    );
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.status(200).json({
      error: false,
      reviews,
      lastUpdated: Date.now(),
    });
  } catch (error) {
    console.error(`Review delete error:`, error);
    res.status(500).json({
      message: "Unable to delete review. Please try again later.",
      error: error.message,
    });
  }
});
router.put("/status", verifyToken, async (req, res) => {
  try {
    const { reviewId, status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid review ID." });
    }
    const reviewExists = await Review.findById(reviewId);
    if (!reviewExists) {
      return res
        .status(404)
        .json({ error: true, message: "Review not found." });
    }
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        error: true,
        message: "Not authorized to update review status.",
      });
    }
    const reviews = await Review.findByIdAndUpdate(
      reviewId,
      { status: status },
      { new: true }
    ).sort({ createdAt: -1 });
    await Timestamp.findOneAndUpdate(
      { type: "review" },
      { updatedAt: Date.now() },
      { new: true }
    );
    return res.status(200).json({
      error: false,
      message: "Review status updated successfully",
      reviews,
      lastUpdated: Date.now(),
    });
  } catch (err) {
    console.error("Error updating review status:", err);
    res.status(500).json({
      error: true,
      message: "Unable to update review status. Please try again.",
      details: err.message,
    });
  }
});

export default router;
