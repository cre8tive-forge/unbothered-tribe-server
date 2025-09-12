import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/users.js";
import bcryptjs from "bcryptjs";
import { LoginCodes } from "../models/login_codes.js";
import {
  codeEmailTemplate,
  mailOptions,
  transporter,
} from "../config/nodemailer.js";
import { upload, uploadToCloudinary } from "../resources/multer.js";
import { Timestamp } from "../models/timestamps.js";
import verifyToken from "../middleware/verifyToken.js";
const router = express.Router();
router.post("/email/change/verify", verifyToken, async (req, res) => {
  const { email } = req.body;

  if (!email)
    return res.status(400).json({ error: true, message: "Email is required" });
  const emailExists = await User.findOne({ email });
  if (emailExists) {
    return res.status(400).json({
      error: true,
      message: "An account with this email already exists.",
    });
  }
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000);
  await LoginCodes.findOneAndUpdate(
    { email },
    { code, expires_at },
    { upsert: true, new: true }
  );

  const token = jwt.sign(
    {
      email,
      code,
      issuedAt: Date.now(),
    },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );

  try {
    await transporter.sendMail({
      ...mailOptions,
      subject: `Your temporary Cre8tive Forge code is ${code}`,
      to: email,
      html: codeEmailTemplate.replace("{{LOGIN_CODE}}", code),
    });
    return res
      .status(200)
      .json({ error: false, message: "Code sent to email.", email });
  } catch (err) {
    console.error("Error sending mail:", err);
    return res
      .status(500)
      .json({ error: true, message: "Failed to send code." });
  }
});

router.post("/email/change", verifyToken, async (req, res) => {
  const { newEmail, oldEmail, code } = req.body;

  if (!oldEmail || !code || !newEmail) {
    return res
      .status(400)
      .json({ error: true, message: "Email and code are required." });
  }

  try {
    const entry = await LoginCodes.findOne({ email: newEmail });
    if (!entry) {
      return res.status(400).json({
        error: true,
        message: "Invalid code or code does not exist.",
      });
    }
    if (code !== entry.code) {
      return res.status(400).json({ error: true, message: "Invalid code." });
    }
    if (new Date(entry.expires_at) < new Date()) {
      await LoginCodes.deleteOne({ email: newEmail });
      return res
        .status(400)
        .json({ error: true, message: "Code has expired." });
    }
    await User.findOneAndUpdate(
      { email: oldEmail },
      { $set: { email: newEmail } }
    );
    const user = await User.findOne({ email: newEmail });
    if (!user)
      return res.status(401).json({
        error: true,
        message: "You are not authorized to perfom this action",
      });
    await Timestamp.findOneAndUpdate(
      { type: "user" },
      { updatedAt: Date.now() },
      { new: true }
    );

    const userObj = user.toObject();
    delete userObj.password;
    return res.status(200).json({
      error: false,
      message: "Email address updated successfully",
      email: newEmail,
      user: userObj,
    });
  } catch (err) {
    console.error("Error sending mail:", err);
    return res
      .status(500)
      .json({ error: true, message: "Failed to send code." });
  }
});

router.post("/name/change", verifyToken, async (req, res) => {
  const { firstname, lastname, email } = req.body;

  if (!firstname || !lastname || !email) {
    return res.status(400).json({
      error: true,
      message: "Name and email are required.",
    });
  }

  try {
    const updatedUser = await User.findOneAndUpdate(
      { email: email },
      { $set: { firstname: firstname, lastname: lastname } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        error: true,
        message: "User not found.",
      });
    }
    await Timestamp.findOneAndUpdate(
      { type: "user" },
      { updatedAt: Date.now() },
      { new: true }
    );

    const userObj = updatedUser.toObject();
    delete userObj.password;
    return res.status(200).json({
      error: false,
      message: "Name updated successfully!",
      firstname,
      lastname,
    });
  } catch (err) {
    console.error("Error updating name:", err);
    return res.status(500).json({
      error: true,
      message: "Failed to update name. Please try again later.",
    });
  }
});

router.post("/password/change", verifyToken, async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;

  if (!email || !newPassword || !confirmPassword) {
    return res.status(400).json({
      error: true,
      message: "Email, new password, and confirm password are required.",
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      error: true,
      message: "Passwords do not match.",
    });
  }

  const passwordRegex =
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()])[A-Za-z\d!@#$%^&*()]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({
      error: true,
      message:
        "Password must be at least 8 characters long and contain at least one letter and one number.",
    });
  }

  try {
    const hashedPassword = await bcryptjs.hash(newPassword, 10);
    const updatedUser = await User.findOneAndUpdate(
      { email: email },
      { $set: { password: hashedPassword } },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({
        error: true,
        message: "User not found.",
      });
    }
    await Timestamp.findOneAndUpdate(
      { type: "user" },
      { updatedAt: Date.now() },
      { new: true }
    );

    const userObj = updatedUser.toObject();
    delete userObj.password;

    return res.status(200).json({
      error: false,
      message: "Password updated successfully!",
      user: userObj,
    });
  } catch (err) {
    console.error("Error updating password:", err);
    return res.status(500).json({
      error: true,
      message: "Failed to update password. Please try again.",
    });
  }
});

router.post("/delete-account", verifyToken, async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: true,
      message: "User ID is required to delete the account.",
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ error: true, message: "User not found." });

    await LoginCodes.deleteMany({ email: user.email });
    await User.deleteOne({ _id: userId });

    res.clearCookie("token", {
      httpOnly: true,
      sameSite: "none",
      secure: true,
    });
    await Timestamp.findOneAndUpdate(
      { type: "user" },
      { updatedAt: Date.now() },
      { new: true }
    );

    return res.status(200).json({
      error: false,
      message: "Account deleted successfully. You have been logged out.",
    });
  } catch (err) {
    console.error("Error deleting account:", err);
    return res.status(500).json({
      error: true,
      message: "Failed to delete account. Please try again.",
    });
  }
});

router.post(
  "/upload-avatar",
  verifyToken,
  upload.single("avatar"),
  async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || !req.file) {
        return res
          .status(400)
          .json({ error: true, message: "Email and image are required." });
      }

      const imageUrl = await uploadToCloudinary(req.file.buffer);

      if (!imageUrl) {
        return res
          .status(500)
          .json({ error: true, message: "Failed to upload to Cloudinary." });
      }

      const updatedUser = await User.findOneAndUpdate(
        { email: email },
        { $set: { profilePhoto: imageUrl } },
        { new: true }
      );

      if (!updatedUser) {
        return res
          .status(404)
          .json({ error: true, message: "User not found." });
      }
      await Timestamp.findOneAndUpdate(
        { type: "user" },
        { updatedAt: Date.now() },
        { new: true }
      );

      const userObj = updatedUser.toObject();
      delete userObj.password;

      return res.status(200).json({
        error: false,
        message: "Profile photo updated successfully!",
        user: userObj,
      });
    } catch (err) {
      console.error("Error uploading profile photo:", err);
      return res.status(500).json({
        error: true,
        message: "Failed to upload photo. Please try again.",
      });
    }
  }
);

router.post("/information/update", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const user = User.findOne({ userId });
  const {
    facebook,
    instagram,
    linkedin,
    twitter,
    tiktok,
    whatsapp,
    description,
    organization,
    websiteUrl,
    nin,
    username,
  } = req.body;

  if (!user) {
    return res.status(401).json({
      error: true,
      message: "User does not exist",
    });
  }

  try {
    if (whatsapp !== "") {
      const existingUser = await User.findOne({
        "socials.whatsapp": whatsapp,
      });

      if (existingUser && existingUser._id.toString() !== userId) {
        return res.status(409).json({
          error: true,
          message: "This WhatsApp number is already in use by another user.",
        });
      }
    }

    const updateFields = {
      "socials.facebook": facebook,
      "socials.instagram": instagram,
      "socials.linkedin": linkedin,
      "socials.twitter": twitter,
      "socials.tiktok": tiktok,
      "socials.whatsapp": whatsapp,
      description,
      organization,
      websiteUrl,
      username,
    };

    if (user.kycStatus !== "verified") {
      if (nin && nin !== "") {
        updateFields.nin = nin;
        updateFields.kycStatus = "pending";
      }
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      { $set: updateFields },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({
        error: true,
        message: "User not found.",
      });
    }
    await Timestamp.findOneAndUpdate(
      { type: "user" },
      { updatedAt: Date.now() },
      { new: true }
    );
    return res.status(200).json({
      error: false,
      message: "Profile information updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Error updating profile information:", err);
    return res.status(500).json({
      error: true,
      message: "Failed to update profile information. Please try again later.",
    });
  }
});
export default router;
