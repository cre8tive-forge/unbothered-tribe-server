import express from "express";
import { Timestamp } from "../models/timestamps.js";
import { Report } from "../models/reports.js";
import verifyToken from "../middleware/verifyToken.js";
import axios from "axios";
const router = express.Router();
router.post("/store", async (req, res) => {
  const {
    fullname,
    number,
    email,
    message,
    captchaToken,
    property,
    category,
    agent,
  } = req.body;

  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const captchaResponse = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`
    );
    const captchaData = captchaResponse.data;
    const ipAddress = req.ip;
    const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
    const data = await response.json();

    if (!captchaData.success) {
      return res.status(401).json({
        error: true,
        message: "Recaptcha verification failed. Please try again",
      });
    }

    const existingReport = await Report.findOne({
      $or: [{ email: email }, { number: number }],
      property: property,
    });

    if (existingReport) {
      return res.status(409).json({
        error: true,
        message: "You have already submitted a report for this listing.",
      });
    }

    const country = data.country ? data.country : "Unknown";
    await Report.create({
      fullname,
      email,
      property,
      number,
      message,
      country,
      agent,
      category,
    });
    await Timestamp.findOneAndUpdate(
      { type: "report" },
      { $set: { updatedAt: Date.now() } },
      {
        new: true,
        upsert: true,
      }
    );
    return res.status(200).json({
      error: false,
      message: "Your report has been submitted successfully",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      error: true,
      message: "Unable to submit your report. Please try again",
    });
  }
});
router.get("/fetch", verifyToken, async (req, res) => {
  try {
    const reports = await Report.find()
      .sort({ createdAt: -1 })
      .populate("property", "title price images _id")
      .populate("agent", "firstname lastname _id profilePhoto");
    res.status(200).json(reports);
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Failed to fetch reports.",
    });
  }
});
router.post("/delete", verifyToken, async (req, res) => {
  const { reportId } = req.body;
  try {
    const reportToDelete = await Report.findByIdAndDelete(reportId);
    if (!reportToDelete) {
      return res.status(404).json({
        error: true,
        message: "The requested report could not be found.",
      });
    }
    await Timestamp.findOneAndUpdate(
      { type: "report" },
      { updatedAt: Date.now() },
      { new: true }
    );
    const reports = await Report.find().sort({ createdAt: -1 });
    res.status(200).json({
      error: false,
      reports,
      lastUpdated: Date.now(),
    });
  } catch (error) {
    console.error(`Report delete error:`, error);
    res.status(500).json({
      message: "Unable to delete report. Please try again later.",
      error: error.message,
    });
  }
});
export default router;
