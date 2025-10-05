import express from "express";
import { Timestamp } from "../models/timestamps.js";
import verifyToken from "../middleware/verifyToken.js";
import bcryptjs from "bcryptjs";
import { User } from "../models/users.js";
import { PasswordChangedMail } from "../config/emailTemplates.js";
import { sendEmail } from "../config/zohoMailer.js";
import jwt from "jsonwebtoken";
const router = express.Router();

router.post("/password/update", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        error: true,
        message: "User not found.",
      });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({
        error: true,
        message: "Current password is required.",
      });
    }

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        error: true,
        message: "New password must be at least 8 characters long.",
      });
    }

    if (!confirmPassword || newPassword !== confirmPassword) {
      return res.status(400).json({
        error: true,
        message: "Passwords do not match.",
      });
    }

    const passwordMatch = await bcryptjs.compare(
      currentPassword,
      user.password
    );
    if (!passwordMatch) {
      return res.status(401).json({
        error: true,
        message: "Invalid current password.",
      });
    }

    const samePassword = await bcryptjs.compare(newPassword, user.password);
    if (samePassword) {
      return res.status(400).json({
        error: true,
        message: "New password must be different from current password.",
      });
    }

    const salt = await bcryptjs.genSalt(10);
    user.password = await bcryptjs.hash(newPassword, salt);
    await user.save();

    await Timestamp.findOneAndUpdate(
      { type: "user" },
      { updatedAt: Date.now() },
      { new: true, upsert: true }
    );

    const html = PasswordChangedMail.trim().replace(
      /{{FIRSTNAME}}/g,
      user.firstname
    );
    await sendEmail({
      to: user.email,
      subject: "Your Unbothered Tribe password was changed",
      html,
    });

    return res.json({
      error: false,
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    return res.status(500).json({
      error: true,
      message: "Unable to update password. Please try again later.",
    });
  }
});
router.post("/profile/update", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        error: true,
        message: "User not found.",
      });
    }

    const { firstname, lastname, email } = req.body;

    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email: email });
      if (emailExists) {
        return res.status(401).json({
          error: true,
          message: "Email address already exists",
        });
      }
    }

    if (firstname !== undefined) user.firstname = firstname;
    if (lastname !== undefined) user.lastname = lastname;
    if (email !== undefined) user.email = email;

    await user.save();

    await Timestamp.findOneAndUpdate(
      { type: "user" },
      { updatedAt: Date.now() },
      { new: true, upsert: true }
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
        message: "Profile updated successfully",
      });
  } catch (error) {
    console.error("Profile update error:", error);
    return res.status(500).json({
      error: true,
      message: "An error occurred while updating the profile.",
    });
  }
});

export default router;
