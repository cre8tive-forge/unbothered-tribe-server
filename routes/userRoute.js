import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import { User } from "../models/users.js";

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
router.get("/last-updated", verifyToken, async (req, res) => {
  try {
    const latest = await User.findOne().sort({ createdAt: -1 });
    res.json({ lastUpdated: latest?.updatedAt?.getTime() || Date.now() });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
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

    const updatedUser = await User.findByIdAndUpdate(
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

    if (updatedUser) {
      const latestUser = await User.findOne().sort({ createdAt: -1 });
      if (latestUser) {
        latestUser.updatedAt = new Date();
        await latestUser.save();
      }
      const currentUserId = req.user.id;
      const users = await User.find({ _id: { $ne: currentUserId } })
        .sort({
          createdAt: -1,
        })
        .select("-password");
      res.status(200).json({
        error: false,
        users,
        message: "User details updated successfully",
        lastUpdated: latestUser ? latestUser.updatedAt : Date.now(),
      });
    } else {
      return res.status(404).json({
        error: true,
        message: "User not found for update.",
      });
    }
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
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({
        error: true,
        message: "The requested user could not be found.",
      });
    }
    const latestUser = await User.findOne().sort({ createdAt: -1 });
    if (latestUser) {
      latestUser.updatedAt = new Date();
      await latestUser.save();
    }
    const currentUserId = req.user.id;
    const users = await User.find({ _id: { $ne: currentUserId } })
      .sort({
        createdAt: -1,
      })
      .select("-password");
    res.status(200).json({
      error: false,
      users,
      message: "User deleted successfully",
      lastUpdated: latestUser ? latestUser.updatedAt : Date.now(),
    });
  } catch (error) {
    console.error(`User delete error:`, error);
    res.status(500).json({
      message: "Unable to delete User. Please try again later.",
      error: error.message,
    });
  }
});
export default router;
