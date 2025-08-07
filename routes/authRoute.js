import express from "express";
import jwt from "jsonwebtoken";
import { Admin } from "../models/admins.js";
import bcryptjs from "bcryptjs";
import { LoginCodes } from "../models/login_codes.js";
import nodemailer from "nodemailer";
const router = express.Router();
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

router.post("/login/code", async (req, res) => {
  const { email } = req.body;

  if (!email)
    return res.status(400).json({ error: true, message: "Email is required" });

  const admin = await Admin.findOne({ email });
  if (!admin)
    return res.status(401).json({ error: true, message: "Account not found." });
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000);
  await LoginCodes.findOneAndUpdate(
    { email },
    { code, expires_at },
    { upsert: true, new: true }
  );

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const templatePath = path.join(
    __dirname,
    "../templates/login-code-email.html"
  );

  const htmlTemplate = fs
    .readFileSync(templatePath, "utf-8")
    .replace("{{LOGIN_CODE}}", code)
    .replace(
      "{{LOGIN_LINK}}",
      `https://yourapp.com/login?email=${email}&code=${code}`
    );
  const mailOptions = {
    from: `Cre8tive Forge <${process.env.MAIL_USERNAME}>`,
    to: email,
    subject: `Your temporary Cre8tive Forge login code is ${code}`,
    html: htmlTemplate,
  };
  try {
    await transporter.sendMail(mailOptions);
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

router.post("/login", async (req, res) => {
  const { email, code, password } = req.body;
  if (!email || !code)
    return res
      .status(400)
      .json({ error: true, message: "Email and code are required." });
  try {
    const entry = await LoginCodes.findOne({ email });
    if (!entry) return res.status(400).json({ message: "Invalid code" });
    if (code !== entry.code)
      return res.status(400).json({ message: "Invalid code" });
    if (new Date(entry.expires_at) < new Date()) {
      await LoginCodes.deleteOne({ email });
      return res
        .status(400)
        .json({ error: true, message: "Code has expired." });
    }
    await LoginCodes.deleteOne({ email });
    const admin = await Admin.findOne({ email });
    if (!admin)
      return res
        .status(401)
        .json({ error: true, message: "Invalid credentials" });
    const isMatch = await bcryptjs.compare(password, admin.password);
    if (!isMatch)
      return res.status(401).json({ error: true, message: "Invalid password" });
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
      maxAge: 24 * 60 * 60 * 1000,
    });
    return res.status(200).json({
      error: false,
      token: token,
      message: "Code verified. Login successful.",
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// router.post("/signup", async (req, res) => {
//   const { email, password } = req.body;
//   try {
//     const findAdmin = await Admin.findOne({ email });
//     if (findAdmin)
//       return res
//         .status(401)
//         .json({ error: true, message: "Admin Aready exists" });
//     const hashedPassword = await bcryptjs.hash(password, 10);
//     const createAdmin = await Admin.create({
//       email: email,
//       password: hashedPassword,
//     });
//     return res.json({ error: true, message: "Admin Created successfully" });
//   } catch {
//     res.status(500).json({ error: "Something went wrong" });
//   }
// });

router.post("/logout", (req, res) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    sameSite: "None",
    secure: true,
  });
  res.json({ error: false, message: "Logged out successfully" });
});

export default router;
