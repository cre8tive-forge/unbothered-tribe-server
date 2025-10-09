import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import { User } from "../models/users.js";
import { Timestamp } from "../models/timestamps.js";
import jwt from "jsonwebtoken";
import { Product } from "../models/products.js";
const router = express.Router();

router.post("/favorites/add", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { productId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: true, message: "User not found." });
    }

    if (user.wishlist.includes(productId)) {
      return res.status(401).json({
        error: true,
        message: "Product already saved to your wishlist",
      });
    } else {
      user.wishlist.push(productId);
      user.updatedAt = Date.now();
      await user.save();
      await Timestamp.findOneAndUpdate(
        { type: "wishlist" },
        { $set: { updatedAt: Date.now() } },
        {
          new: true,
          upsert: true,
        }
      );

      const userObj = user.toObject();
      delete userObj.password;

      const payload = {
        id: user._id,
        ...userObj,
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "1d",
      });

      return res
        .cookie("auth_token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "None",
          maxAge: 24 * 60 * 60 * 1000,
        })
        .status(200)
        .json({
          error: false,
          token,
          user: userObj,
          message: "Product successfully added to your wishlist.",
        });
    }
  } catch (err) {
    res.status(500).json({
      message: "Unable to add product to your wishlist",
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
    const favourites = await Product.find({
      _id: { $in: findUser.wishlist },
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
router.post("/remove", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { productId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: true, message: "User not found." });
    }
    const listingIndex = user.wishlist.indexOf(productId);
    if (listingIndex > -1) {
      user.wishlist.splice(listingIndex, 1);
      user.updatedAt = Date.now();
      await user.save();

      await Timestamp.updateMany(
        { type: { $in: ["wishlist", "user", "product"] } },
        { $set: { updatedAt: Date.now() } }
      );

      const wishlist = await Product.find({
        _id: { $in: user.wishlist },
      }).sort({ createdAt: -1 });

      return res.status(200).json({
        error: false,
        wishlist,
        message: "Product removed from wishlist successfully.",
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
