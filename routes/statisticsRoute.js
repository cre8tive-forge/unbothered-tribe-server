import express from "express";
import { Property } from "../models/property.js";

const router = express.Router();
router.get("/listings-by-month", async (req, res) => {
  try {
    // get today's date
    const now = new Date();
    // get date 6 months ago
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 5); // includes current month, so -5 not -6

    const listings = await Property.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }, // only last 6 months
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: 1,
            },
          },
          count: 1,
        },
      },
    ]);

    res.status(200).json(listings);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch listing statistics" });
  }
});

export default router;
