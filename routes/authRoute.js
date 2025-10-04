import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/users.js";
import bcryptjs from "bcryptjs";
import { LoginCodes } from "../models/login_codes.js";
import {
  adminWelcomeMail,
  codeEmailTemplate,
  welcomeMail,
} from "../config/emailTemplates.js";
import { Timestamp } from "../models/timestamps.js";
import { sendEmail } from "../config/zohoMailer.js";
const router = express.Router();
function cleanEmail(email) {
  return String(email)
    .trim()
    .replace(/[\s<>]/g, "");
}
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
    await sendEmail({
      to: email,
      subject: `Your temporary Househunter code is ${code}`,
      html: codeEmailTemplate
        .replaceAll("{{LOGIN_CODE}}", code)
        .replaceAll("{{FIRSTNAME}}", user.firstname),
    });

    return res
      .status(200)
      .json({ error: false, message: "Code sent to email." });
  } catch (err) {
    console.error("Error sending mail:", err);
    console.log("Error sending mail:", err);
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
  const { email, password } = req.body;
  if (!email || !password)
    return res
      .status(400)
      .json({ error: true, message: "Email and password are required." });

  try {
    let user = await User.findOne({ email });

    if (!user)
      return res
        .status(401)
        .json({ error: true, message: "Account does not exist" });

    const passwordMatch = await bcryptjs.compare(password, user.password);
    if (!passwordMatch) {
      return res
        .status(401)
        .json({ error: true, message: "Invalid credentials" });
    }

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
        message: `Welcome ${user.firstname}!`,
      });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      error: true,
      message: "Unable to process your request. Please try again ",
    });
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
  const { firstname, lastname, email, password, confirmPassword } = req.body;
  if (confirmPassword !== password) {
    return res.status(401).json({
      error: true,
      message: "Passwords does not match",
    });
  }
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(409).json({
        error: true,
        message: "This email address already exists",
      });
    }

    const ipAddress = req.ip;
    const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
    const data = await response.json();
    const country = data.country ? data.country : "Unknown";

    const salt = await bcryptjs.genSalt(10);
    const hashPassword = await bcryptjs.hash(password, salt);

    const createUser = await User.create({
      firstname,
      lastname,
      email,
      password: hashPassword,
      country,
    });
    const updateTimestamp = await Timestamp.findOneAndUpdate(
      { type: "user" },
      { $set: { updatedAt: Date.now() } },
      {
        new: true,
        upsert: true,
      }
    );

    const adminhtml = adminWelcomeMail
      .trim()
      .replace(/{{FIRSTNAME}}/g, firstname)
      .replace(/{{LASTNAME}}/g, lastname)
      .replace(/{{EMAIL}}/g, email)
      .replace(/{{COUNTRY}}/g, country);

    const html = welcomeMail
      .trim()
      .replace(/{{FIRSTNAME}}/g, firstname)
      .replace(/{{LASTNAME}}/g, lastname);

    try {
      await sendEmail({
        to: "business.cre8tiveforge@gmail.com",
        subject: "New user registered on Unbothered Tribe",
        html: adminhtml,
      });
    } catch (emailError) {
      console.error(
        "Welcome email failed to send to admin:",
        emailError.response?.data || emailError.message
      );
    }

    let emailSentSuccessfully = false;
    const subject = `Welcome to the Unbothered Tribe, ${firstname}!`;
    try {
      await sendEmail({ to: email, subject, html });
      emailSentSuccessfully = true;
    } catch (emailError) {
      console.error(
        "Welcome email failed to send:",
        emailError.response?.data || emailError.message
      );
      emailSentSuccessfully = false;
    }

    if (createUser && updateTimestamp) {
      if (emailSentSuccessfully) {
        return res.status(201).json({
          error: false,
          message: `Welcome to the Unbothered Tribe, ${firstname} ${lastname}! Proceed to login`,
        });
      } else {
        return res.status(201).json({
          error: false,
          message: `Account created successfully. Proceed to login`,
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
        await sendEmail({
          to: email,
          subject: `Welcome to HouseHunter.ng, ${firstname}! `,
          html: welcomeMail
            .replace(/{{FIRSTNAME}}/g, firstname)
            .replace(/{{LASTNAME}}/g, ""),
        });

      return res.status(201).json({
        error: false,
        message: `Welcome to HouseHunter, ${firstname}! Proceed to login`,
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
