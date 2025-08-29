import express from "express";
import { Timestamp } from "../models/timestamps.js";
const router = express.Router();
router.get("/:id/updatedAt", async (req, res) => {
  const timestampId = req.params.id;
  try {
    const latest = await Timestamp.findOne({ type: timestampId }).sort({
      updatedAt: -1,
    });
    res.json({ lastUpdated: latest?.updatedAt?.getTime() || Date.now() });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error", error });
  }
});
export default router;