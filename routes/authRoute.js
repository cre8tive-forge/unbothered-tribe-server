import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/users.js";
import bcryptjs from "bcryptjs";
import { LoginCodes } from "../models/login_codes.js";
import {
  htmlTemplate,
  mailOptions,
  transporter,
} from "../config/nodemailer.js";
import { upload, uploadToCloudinary } from "../resources/multer.js";
import { Timestamp } from "../models/timestamps.js";
const router = express.Router();

router.get("/verifyUser", async (req, res) => {
  try {
    const token = req.cookies.auth_token;
    if (!token) {
      return res.status(401).json({ error: true, message: "Not logged in" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(404).json({ error: true, message: "User not found" });
    }
    res.json({ error: false, user });
  } catch (err) {
    res.status(401).json({ error: true, message: "Invalid or expired token" });
  }
});

router.post("/login/code", async (req, res) => {
  const { email } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000);
  if (!email)
    return res.status(400).json({ error: true, message: "Email is required" });
  let user = await User.findOne({ email });
  if (!user)
    return res.status(401).json({ error: true, message: "Account not found" });
  await LoginCodes.findOneAndUpdate(
    { email: email },
    { code, expires_at },
    { upsert: true, new: true }
  );

  try {
    await transporter.sendMail({
      ...mailOptions,
      subject: `Your temporary RentaHome code is ${code}`,
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
    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({
        error: true,
        message: "Account not found",
      });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );
    const userObj = user.toObject();
    delete userObj.password;
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
        message: "Login successful. Redirecting...",
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

    let user = await User.findOne({ email });

    if (!user)
      return res
        .status(401)
        .json({ error: true, message: "Account not found" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    let userObj = user.toObject();
    delete userObj.password;

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

router.post("/logout", async (req, res) => {
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

router.post("/name/change", async (req, res) => {
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

router.post("/delete-account", async (req, res) => {
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

    const updatedUser = await User.findOneAndUpdate(
      { email: email },
      { $set: { profilePhoto: imageUrl } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: true, message: "User not found." });
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
});

router.post("/signup", async (req, res) => {
  const { firstname, lastname, phoneNumber, email, password, role } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists)
      return res
        .status(409)
        .json({ error: true, message: "This email address already exists" });
    else {
      const ipAddress = req.ip;
      const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
      const data = await response.json();

      const country = data.country ? data.country : "Unknown";
      const salt = await bcryptjs.genSalt(10),
        hashPassword = await bcryptjs.hash(password, salt);

      const createUser = await User.create({
        firstname: firstname,
        lastname: lastname,
        number: phoneNumber,
        email: email,
        password: hashPassword,
        country: country,
        role: role,
      });

      const updateTimestamp = await Timestamp.findOneAndUpdate(
        { type: "user" },
        { $set: { updatedAt: Date.now() } },
        {
          new: true,
          upsert: true,
        }
      );

      if (createUser && updateTimestamp)
        return res.status(201).json({
          error: false,
          message: `Welcome to HouseHunter, ${firstname} ${lastname}`,
        });
    }
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Unable to create your account. Please try again",
    });
  }
});

router.post("/google/signup", async (req, res) => {
  const { firstname, email, type, role } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(409).json({
        error: true,
        message: "Account already exists. Proceed to login",
      });
    else {
      const ipAddress = req.ip;
      const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
      const data = await response.json();

      const country = data.country ? data.country : "Unknown";

      const createUser = await User.create({
        firstname,
        email,
        country,
        type,
        role,
      });
      const updateTimestamp = await Timestamp.findOneAndUpdate(
        { type: "user" },
        { $set: { updatedAt: Date.now() } },
        {
          new: true,
          upsert: true,
        }
      );
      if (createUser && updateTimestamp)
        return res.status(201).json({
          error: false,
          message: `Welcome to HouseHunter, ${firstname}`,
        });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: true,
      message: "Unable to create your account. Please try again",
    });
  }
});

export default router;
