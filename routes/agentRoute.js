import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import { User } from "../models/users.js";
const router = express.Router();

router.get("/fetch", verifyToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const agents = await User.find({
      role: "Agent",
      _id: { $ne: currentUserId },
    })
      .sort({
        createdAt: -1,
      })
      .select("-password");
    res.status(200).json(agents);
  } catch (err) {
    console.error("Failed to fetch agents:", err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch agents.",
    });
  }
});
router.get("/fetch/order", verifyToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const agents = await User.find({
      role: "Agent",
      _id: { $ne: currentUserId },
    })
      .sort({ totalListing: -1 })
      .select("-password");

    res.status(200).json(agents);
  } catch (err) {
    console.error("Failed to fetch agents:", err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch agents.",
    });
  }
});

export default router;
