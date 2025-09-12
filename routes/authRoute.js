import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/users.js";
import bcryptjs from "bcryptjs";
import { LoginCodes } from "../models/login_codes.js";
import {
  codeEmailTemplate,
  mailOptions,
  transporter,
  welcomeMail,
} from "../config/nodemailer.js";
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
      subject: `Your temporary Househunter code is ${code}`,
      to: email,
      html: codeEmailTemplate.replaceAll("{{LOGIN_CODE}}", code),
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

    const userObj = user.toObject();
    delete userObj._id;
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

    const userObj = user.toObject();
    delete userObj._id;
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

router.post("/signup", async (req, res) => {
  const { firstname, lastname, phoneNumber, email, password, role } = req.body;
  try {
    const trimmedNumber = phoneNumber.trim();

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(409).json({
        error: true,
        message: "This email address already exists",
      });
    }

    const numberExists = await User.findOne({ number: trimmedNumber });
    if (numberExists) {
      return res.status(409).json({
        error: true,
        message: "This phone number already exists",
      });
    } else {
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
      const sendmail = await transporter.sendMail({
        ...mailOptions,
        subject: `Welcome to HouseHunter.ng, ${firstname}!`,
        to: email,
        html: welcomeMail
          .replace(/{{FIRSTNAME}}/g, firstname)
          .replace(/{{LASTNAME}}/g, lastname),
      });

      if (createUser && updateTimestamp)
        if (sendmail) {
          return res.status(201).json({
            error: false,
            message: `Welcome to HouseHunter, ${firstname} ${lastname}`,
          });
        } else {
          return res.status(400).json({
            error: true,
            message: "Mail Sending failed",
          });
        }
    }
  } catch (error) {
    console.log(error);
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
        await transporter.sendMail({
          ...mailOptions,
          subject: `Welcome to HouseHunter.ng, ${firstname}!`,
          to: email,
          html: welcomeMail
            .replace(/{{FIRSTNAME}}/g, firstname)
            .replace(/{{LASTNAME}}/g, ""),
        });
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
