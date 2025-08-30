import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import { User } from "../models/users.js";
import { Timestamp } from "../models/timestamps.js";
import { Enquiry } from "../models/enquiries.js";
import { Review } from "../models/reviews.js";

const router = express.Router();
router.get("/fetch", verifyToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const users = await User.find({
      role: "User",
      _id: { $ne: currentUserId },
    })
      .sort({
        createdAt: -1,
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
router.post("/edit/save", verifyToken, async (req, res) => {
  const {
    firstname,
    middlename,
    lastname,
    number,
    email,
    role,
    status,
    userId,
  } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: true,
        message: "The requested user could not be found.",
      });
    }

    const existingUser = await User.findOne({
      _id: { $ne: userId },
      $or: [{ email: email }, { number: number }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(409).json({
          error: true,
          message: "This email address already exists.",
        });
      }
      if (existingUser.number === number) {
        return res.status(409).json({
          error: true,
          message: "This phone number already exists.",
        });
      }
    }

    await User.findByIdAndUpdate(
      userId,
      {
        firstname,
        middlename,
        lastname,
        number,
        email,
        role,
        status,
      },
      { new: true }
    );

    await Timestamp.findOneAndUpdate(
      { type: "user" },
      { updatedAt: Date.now() },
      { new: true }
    );
    const currentUserId = req.user.id;
    const users = await User.find({
      role: "User",
      _id: { $ne: currentUserId },
    })
      .sort({
        createdAt: -1,
      })
      .select("-password");
    res.status(200).json({
      error: false,
      users,
      message: "User details updated successfully",
      lastUpdated: Date.now(),
    });
  } catch (error) {
    console.error("Failed to edit user details:", error);
    res.status(500).json({
      error: true,
      message: "Failed to edit user details.",
    });
  }
});
router.post("/delete", verifyToken, async (req, res) => {
  const { userId } = req.body;
  try {
    await Review.deleteMany({ user: userId });

    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({
        error: true,
        message: "The requested user could not be found.",
      });
    }
    await Timestamp.updateMany(
      { type: { $in: ["user", "review"] } },
      { $set: { updatedAt: Date.now() } }
    );

    const currentUserId = req.user.id;
    const users = await User.find({ _id: { $ne: currentUserId } })
      .sort({ createdAt: -1 })
      .select("-password");

    res.status(200).json({
      error: false,
      users,
      message: "User deleted successfully",
      lastUpdated: Date.now(),
    });
  } catch (error) {
    console.error("User delete error:", error);
    res.status(500).json({
      message: "Unable to delete User. Please try again later.",
      error: error.message,
    });
  }
});

export default router;
