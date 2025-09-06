import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import { User } from "../models/users.js";
import { Property } from "../models/property.js";
import { Timestamp } from "../models/timestamps.js";
const router = express.Router();

router.post("/favorites/add", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { listingId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: true, message: "User not found." });
    }

    if (user.favoriteListings.includes(listingId)) {
      return res.status(401).json({
        error: true,
        message: "Listing already saved to your favourites",
      });
    } else {
      user.favoriteListings.push(listingId);
      user.updatedAt = Date.now();
      await user.save();
      await Timestamp.findOneAndUpdate(
        { type: "favourite" },
        { $set: { updatedAt: Date.now() } },
        {
          new: true,
          upsert: true,
        }
      );
      res.status(200).json({
        error: false,
        message: "Listing added to favorites successfully.",
      });
    }
  } catch (err) {
    res.status(500).json({
      message: "Unable to add listing to favourites",
      error: err.message,
    });
  }
});
router.get("/fetch", verifyToken, async (req, res) => {
  const currentUser = req.user.id;
  try {
    const findUser = await User.findById(currentUser);
    if (!findUser) {
      return res.status(404).json({ error: true, message: "User not found" });
    }
    const favourites = await Property.find({
      _id: { $in: findUser.favoriteListings },
    }).sort({ createdAt: -1 });
    res.status(200).json(favourites);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch saved items.",
    });
  }
});
router.post("/favorites/remove", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { listingId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: true, message: "User not found." });
    }

    const listingIndex = user.favoriteListings.indexOf(listingId);

    if (listingIndex > -1) {
      user.favoriteListings.splice(listingIndex, 1);
      user.updatedAt = Date.now();
      await user.save();

      await Timestamp.findOneAndUpdate(
        { type: "favourite" },
        { $set: { updatedAt: Date.now() } },
        {
          new: true,
          upsert: true,
        }
      );
      const wishlist = await Property.find({
        _id: { $in: user.favoriteListings },
      }).sort({ createdAt: -1 });

      return res.status(200).json({
        error: false,
        wishlist,
        message: "Listing removed from favorites successfully.",
        lastUpdated: Date.now(),
      });
    } else {
      return res.status(404).json({
        error: true,
        message: "Listing not found in your favorites.",
      });
    }
  } catch (err) {
    res.status(500).json({
      message: "Unable to remove listing from favorites.",
      error: err.message,
    });
  }
});
export default router;
