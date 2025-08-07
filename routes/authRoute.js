import express from "express";
import jwt from "jsonwebtoken";
import { Admin } from "../models/admins.js";
import bcryptjs from "bcryptjs";
const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await Admin.findOne({ email });
    if (!admin)
      return res
        .status(401)
        .json({ error: true, message: "Invalid credentials" });

    const isMatch = await bcryptjs.compare(password, admin.password);
    if (!isMatch)
      return res
        .status(401)
        .json({ error: true, message: "Invalid credentials" });

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "None",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    return res.json({
      error: false,
      token: token,
      message: "Login successful",
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
