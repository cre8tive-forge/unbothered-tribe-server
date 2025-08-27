import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import { User } from "../models/users.js";
import { Property } from "../models/property.js";
const router = express.Router();
router.get("/fetch/user", verifyToken, async (req, res) => {
  const currentUser = req.user.id;
  try {
    const findUser = await User.findById(currentUser);
    if (!findUser) {
      return res.status(404).json({ error: true, message: "User not found" });
    }

    const wishlist = await Property.find({
      _id: { $in: findUser.favoriteListings },
    });
    res.status(200).json(wishlist);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch saved items.",
    });
  }
});

router.get("/last-updated/user", verifyToken, async (req, res) => {
  const currentUser = req.user.id;
  try {
    const findUser = await User.findById(currentUser);
    if (!findUser) {
      return res.status(404).json({ error: true, message: "User not found" });
    }
    res.json({ lastUpdated: findUser?.updatedAt?.getTime() || Date.now() });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});
export default router;
