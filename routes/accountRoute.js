import express from "express";
import { Timestamp } from "../models/timestamps.js";
import verifyToken from "../middleware/verifyToken.js";
import bcryptjs from "bcryptjs";
import { User } from "../models/users.js";
import { PasswordChangedMail } from "../config/emailTemplates.js";
import { sendEmail } from "../config/zohoMailer.js";
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

export default router;
