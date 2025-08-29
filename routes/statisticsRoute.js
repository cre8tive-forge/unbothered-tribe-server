import express from "express";
import { Property } from "../models/property.js";
import verifyToken from "../middleware/verifyToken.js";
import { User } from "../models/users.js";

const router = express.Router();
router.get("/listing/fetch/admin", verifyToken, async (req, res) => {
  if (req.user.role !== "Admin") {
    res.status(401).json({
      error: true,
      message: "Unauthorized access",
    });
  }
  try {
    const listings = await Property.find().sort({ updatedAt: -1 });
    res.status(200).json(listings);
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Failed to fetch listings.",
    });
  }
});
router.get("/user/fetch/admin", verifyToken, async (req, res) => {
  if (req.user.role !== "Admin") {
    res.status(401).json({
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
    res.status(200).json(users);
  } catch (err) {
    console.error("Failed to fetch users:", err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch users.",
    });
  }
});
export default router;
