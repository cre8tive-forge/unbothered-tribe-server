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

router.get("/last-updated", verifyToken, async (req, res) => {
  try {
    const latest = await User.findOne().sort({ createdAt: -1 });
    res.json({ lastUpdated: latest?.updatedAt?.getTime() || Date.now() });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});
export default router;
