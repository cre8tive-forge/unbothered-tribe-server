import express from "express";
import { Property } from "../models/property.js";

const router = express.Router();
router.get("/listings-by-month", async (req, res) => {
  try {
    const listings = await Property.aggregate([
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
