import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import { Timestamp } from "../models/timestamps.js";
import { Faq } from "../models/faqs.js";
import mongoose from "mongoose";
const router = express.Router();
router.get("/fetch/admin", verifyToken, async (req, res) => {
  const user = req.user;
  if (user.role !== "Admin") {
    return res.status(400).json({
      error: true,
      message: "You are not authorized to access this route",
    });
  }
  try {
    const faqs = await Faq.find().sort({
      createdAt: -1,
    });

    res.status(200).json(faqs);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch faqs.",
    });
  }
});
router.get("/fetch", async (req, res) => {
  try {
    const faqs = await Faq.find({ status: "published" }).sort({
      createdAt: -1,
    });
    res.status(200).json(faqs);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch faqs.",
    });
  }
});
router.put("/update", verifyToken, async (req, res) => {
  const { faqId, question, answer } = req.body;
  console.log({ faqId, question, answer });
  try {
    const faq = await Faq.findById(faqId);

    if (!faq) {
      return res.status(404).json({
        error: true,
        message: "Faq not found.",
      });
    }
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        error: true,
        message: "Not authorized to update this faq.",
      });
    }

    await Faq.findByIdAndUpdate(
      faqId,
      {
        question,
        answer,
      },
      {
        new: true,
      }
    );

    const faqs = await Faq.find().sort({
      createdAt: -1,
    });

    await Timestamp.findOneAndUpdate(
      { type: "faq" },
      { $set: { updatedAt: Date.now() } },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      error: false,
      message: "Faq updated successfully.",
      faqs,
      lastUpdated: Date.now(),
    });
  } catch (err) {
    console.error("Error updating Faq:", err);
    res.status(500).json({
      error: true,
      message: "Unable to update Faq. Please try again.",
      details: err.message,
    });
  }
});
router.put("/status", verifyToken, async (req, res) => {
  try {
    const { faqId, status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(faqId)) {
      return res.status(400).json({ error: true, message: "Invalid faq ID." });
    }
    const faqExists = await Faq.findById(faqId);
    if (!faqExists) {
      return res.status(404).json({ error: true, message: "Faq not found." });
    }
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        error: true,
        message: "Not authorized to update Faq status.",
      });
    }
    const faqs = await Faq.findByIdAndUpdate(
      faqId,
      { status: status },
      { new: true }
    ).sort({ createdAt: -1 });
    await Timestamp.findOneAndUpdate(
      { type: "faq" },
      { updatedAt: Date.now() },
      { new: true }
    );
    return res.status(200).json({
      error: false,
      message: "Faq status updated successfully",
      faqs,
      lastUpdated: Date.now(),
    });
  } catch (err) {
    console.error("Error updating Faq status:", err);
    res.status(500).json({
      error: true,
      message: "Unable to update Faq status. Please try again.",
      details: err.message,
    });
  }
});
router.post("/delete", verifyToken, async (req, res) => {
  const { faqId } = req.body;
  try {
    if (!mongoose.Types.ObjectId.isValid(faqId)) {
      return res.status(400).json({ error: true, message: "Invalid faq ID." });
    }
    const faqToDelete = await Faq.findByIdAndDelete(faqId);
    if (!faqToDelete) {
      return res.status(404).json({
        error: true,
        message: "The requested faq could not be found.",
      });
    }
    await Timestamp.findOneAndUpdate(
      { type: "faq" },
      { updatedAt: Date.now() },
      { new: true }
    );
    const faqs = await Faq.find().sort({ createdAt: -1 });
    res.status(200).json({
      error: false,
      message: "FAQ deleted successfuly",
      faqs,
      lastUpdated: Date.now(),
    });
  } catch (error) {
    console.error(`Faq delete error:`, error);
    res.status(500).json({
      message: "Unable to delete Faq. Please try again later.",
      error: error.message,
    });
  }
});
router.post("/store", verifyToken, async (req, res) => {
  const { question, answer } = req.body;
  try {
    await Faq.create({ question, answer });

    await Timestamp.findOneAndUpdate(
      { type: "faq" },
      { updatedAt: Date.now() },
      { new: true }
    );
    return res.status(201).json({
      error: false,
      message: "Faq created successfully",
    });
  } catch (error) {
    console.error(`Faq creation error:`, error);
    res.status(500).json({
      message: "Unable to create Faq. Please try again later.",
      error: error.message,
    });
  }
});
export default router;
