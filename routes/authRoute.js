import express from "express";
import jwt from "jsonwebtoken";
import { Admin } from "../models/admins.js";
import bcryptjs from "bcryptjs";
import { LoginCodes } from "../models/login_codes.js";
import nodemailer from "nodemailer";
import {
  code,
  htmlTemplate,
  mailOptions,
  expires_at,
  transporter,
} from "../config/nodemailer.js";
import { upload, uploadToCloudinary } from "../resources/multer.js";
const router = express.Router();

router.get("/verifyUser", async (req, res) => {
  try {
    const token = req.cookies.auth_token;
    if (!token) {
      return res.status(401).json({ error: true, message: "Not logged in" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id).select("-password");

    if (!admin) {
      return res.status(404).json({ error: true, message: "User not found" });
    }

    res.json({ error: false, admin });
  } catch (err) {
    res.status(401).json({ error: true, message: "Invalid or expired token" });
  }
});
router.post("/login/code", async (req, res) => {
  const { email } = req.body;

  if (!email)
    return res.status(400).json({ error: true, message: "Email is required" });

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
      html: htmlTemplate.replace("{{LOGIN_CODE}}", code),
    });
    return res
      .status(200)
      .json({ error: false, message: "Code sent to email." });
  } catch (err) {
    console.error("Error sending mail:", err);
    return res
      .status(500)
      .json({ error: true, message: "Failed to send code." });
  }
});
router.post("/google-login", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: true, message: "Email is required" });
  }

  try {
    const admin = await Admin.findOne({ email });
    if (!admin)
      return res.status(403).json({
        error: true,
        message: "You are not authorized to access this platform.",
      });

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    const adminObj = admin.toObject();
    delete adminObj.password;
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
        admin: adminObj,
        message: "Welcome back admin. Redirecting...",
      });
  } catch (err) {
    console.error("Google login error:", err);
    res.status(500).json({ error: true, message: "Something went wrong" });
  }
});
router.post("/login", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code)
    return res
      .status(400)
      .json({ error: true, message: "Email and code are required." });

  try {
    const entry = await LoginCodes.findOne({ email });
    if (!entry) return res.status(400).json({ message: "Invalid code" });

    if (code != entry.code)
      return res.status(400).json({ message: "Invalid code" });

    if (new Date(entry.expires_at) < new Date()) {
      await LoginCodes.deleteOne({ email });
      return res
        .status(400)
        .json({ error: true, message: "Code has expired." });
    }

    let admin = await Admin.findOne({ email });

    if (!admin) {
      admin = await Admin.create({ email });
    }

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    let adminObj = admin.toObject();
    delete adminObj.password;

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
        admin: adminObj,
        message: "Login successful. Redirecting...",
      });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});
router.post("/verifytoken", async (req, res) => {
  const { token } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { email, code } = decoded;
    res.status(200).json({ error: false, email, code });
  } catch (err) {
    res.status(400).json({ error: true, message: "Invalid or expired token" });
  }
});
router.get("/logout", async (req, res) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    sameSite: "None",
    secure: true,
  });
  res.json({ error: false, message: "Logged out successfully" });
});
router.post("/email/change/verify", async (req, res) => {
  const { email } = req.body;

  if (!email)
    return res.status(400).json({ error: true, message: "Email is required" });
  const emailExists = await Admin.findOne({ email });
  if (emailExists) {
    return res.status(400).json({
      error: true,
      message: "An account with this email already exists.",
    });
  }

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
      html: htmlTemplate.replace("{{LOGIN_CODE}}", code),
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
router.post("/email/change", async (req, res) => {
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
    await Admin.findOneAndUpdate(
      { email: oldEmail },
      { $set: { email: newEmail } }
    );
    const admin = await Admin.findOne({ email: newEmail });
    if (!admin)
      return res.status(401).json({
        error: true,
        message: "You are not authorized to perfom this action",
      });
    const adminObj = admin.toObject();
    delete adminObj.password;
    return res.status(200).json({
      error: false,
      message: "Email address updated successfully",
      email: newEmail,
      admin: adminObj,
    });
  } catch (err) {
    console.error("Error sending mail:", err);
    return res
      .status(500)
      .json({ error: true, message: "Failed to send code." });
  }
});
router.post("/name/change", async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      error: true,
      message: "Name and email are required to update the name.",
    });
  }

  try {
    const updatedAdmin = await Admin.findOneAndUpdate(
      { email: email },
      { $set: { fullname: name } },
      { new: true }
    );

    if (!updatedAdmin) {
      return res.status(404).json({
        error: true,
        message: "User not found.",
      });
    }
    const adminObj = updatedAdmin.toObject();
    delete adminObj.password;
    return res.status(200).json({
      error: false,
      message: "Name updated successfully!",
      name,
    });
  } catch (err) {
    console.error("Error updating name:", err);
    return res.status(500).json({
      error: true,
      message: "Failed to update name. Please try again later.",
    });
  }
});
router.post("/password/change", async (req, res) => {
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
    const updatedAdmin = await Admin.findOneAndUpdate(
      { email: email },
      { $set: { password: hashedPassword } },
      { new: true }
    );
    if (!updatedAdmin) {
      return res.status(404).json({
        error: true,
        message: "User not found.",
      });
    }

    const adminObj = updatedAdmin.toObject();
    delete adminObj.password;

    return res.status(200).json({
      error: false,
      message: "Password updated successfully!",
      admin: adminObj,
    });
  } catch (err) {
    console.error("Error updating password:", err);
    return res.status(500).json({
      error: true,
      message: "Failed to update password. Please try again.",
    });
  }
});
router.post("/delete-account", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: true,
      message: "User ID is required to delete the account.",
    });
  }

  try {
    const admin = await Admin.findById(userId);
    if (!admin)
      return res.status(404).json({ error: true, message: "User not found." });

    await LoginCodes.deleteMany({ email: admin.email });
    await Admin.deleteOne({ _id: userId });

    res.clearCookie("token", {
      httpOnly: true,
      sameSite: "none",
      secure: true,
    });

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
router.post("/upload-avatar", upload.single("avatar"), async (req, res) => {
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

    const updatedAdmin = await Admin.findOneAndUpdate(
      { email: email },
      { $set: { profilePhoto: imageUrl } },
      { new: true }
    );

    if (!updatedAdmin) {
      return res.status(404).json({ error: true, message: "User not found." });
    }

    const adminObj = updatedAdmin.toObject();
    delete adminObj.password;

    return res.status(200).json({
      error: false,
      message: "Profile photo updated successfully!",
      admin: adminObj,
    });
  } catch (err) {
    console.error("Error uploading profile photo:", err);
    return res.status(500).json({
      error: true,
      message: "Failed to upload photo. Please try again.",
    });
  }
});

export default router;
