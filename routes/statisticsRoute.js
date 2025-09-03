import express from "express";
import { Property } from "../models/property.js";
import verifyToken from "../middleware/verifyToken.js";
import { User } from "../models/users.js";
import { Review } from "../models/reviews.js";
import { Enquiry } from "../models/enquiries.js";
import { Contact } from "../models/contacts.js";

const router = express.Router();

router.get("/listing/fetch/admin", verifyToken, async (req, res) => {
  if (req.user.role !== "Admin") {
    return res.status(401).json({
      error: true,
      message: "Unauthorized access",
    });
  }
  try {
    const listings = await Property.find().sort({ updatedAt: -1 });
    return res.status(200).json(listings);
  } catch (err) {
    console.error("Failed to fetch listings:", err);
    return res.status(500).json({
      error: true,
      message: "Failed to fetch listings.",
    });
  }
});

router.get("/user/fetch/admin", verifyToken, async (req, res) => {
  if (req.user.role !== "Admin") {
    return res.status(401).json({
      error: true,
      message: "Unauthorized access",
    });
  }
  try {
    const currentUserId = req.user.id;
    const users = await User.find({
      _id: { $ne: currentUserId },
    })
      .sort({
        updatedAt: -1,
      })
      .select("-password");
    return res.status(200).json(users);
  } catch (err) {
    console.error("Failed to fetch users:", err);
    return res.status(500).json({
      error: true,
      message: "Failed to fetch users.",
    });
  }
});

router.get("/review/fetch/admin", verifyToken, async (req, res) => {
  if (req.user.role !== "Admin") {
    return res.status(401).json({
      error: true,
      message: "Unauthorized access",
    });
  }
  try {
    const currentUserId = req.user.id;
    const reviews = await Review.find({
      user: { $ne: currentUserId },
    }).sort({
      updatedAt: -1,
    });

    return res.status(200).json(reviews);
  } catch (err) {
    console.error("Failed to fetch reviews:", err);
    return res.status(500).json({
      error: true,
      message: "Failed to fetch reviews.",
    });
  }
});

router.get("/enquiry/fetch/admin", verifyToken, async (req, res) => {
  if (req.user.role !== "Admin") {
    return res.status(401).json({
      error: true,
      message: "Unauthorized access",
    });
  }
  try {
    const enquiries = await Enquiry.find().sort({
      updatedAt: -1,
    });

    return res.status(200).json(enquiries);
  } catch (err) {
    console.error("Failed to fetch enquiries:", err);
    return res.status(500).json({
      error: true,
      message: "Failed to fetch enquiries.",
    });
  }
});

router.get("/contact/fetch/admin", verifyToken, async (req, res) => {
  if (req.user.role !== "Admin") {
    return res.status(401).json({
      error: true,
      message: "Unauthorized access",
    });
  }
  try {
    const contacts = await Contact.find().sort({
      updatedAt: -1,
    });

    return res.status(200).json(contacts);
  } catch (err) {
    console.error("Failed to fetch contacts:", err);
    return res.status(500).json({
      error: true,
      message: "Failed to fetch contacts.",
    });
  }
});

router.get("/listings-by-month", async (req, res) => {
  try {
    const listings = await Property.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.year",
          months: {
            $push: {
              month: "$_id.month",
              status: "$_id.status",
              count: "$count",
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    return res.status(200).json(listings);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch listing stats" });
  }
});

router.get("/combined-stats", async (req, res) => {
  try {
    const [
      listings,
      usersByMonth,
      reviewsByMonth,
      enquiriesByMonth,
      contactsByMonth,
    ] = await Promise.all([
      Property.aggregate([
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              status: "$status",
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.year",
            months: {
              $push: {
                month: "$_id.month",
                status: "$_id.status",
                count: "$count",
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              role: "$role",
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.year",
            months: {
              $push: {
                month: "$_id.month",
                role: "$_id.role",
                count: "$count",
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Review.aggregate([
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      Enquiry.aggregate([
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      Contact.aggregate([
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

    return res.status(200).json({
      listings,
      usersByMonth,
      reviewsByMonth,
      enquiriesByMonth,
      contactsByMonth,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Failed to fetch all statistics" });
  }
});

export default router;
