import express from "express";
import { Property } from "../models/property.js";
import { Enquiry } from "../models/enquiries.js";
import { User } from "../models/users.js";
import verifyToken from "../middleware/verifyToken.js";
import { Timestamp } from "../models/timestamps.js";

const router = express.Router();
router.post("/store", async (req, res) => {
  const { name, email, number, message, listingId, medium } = req.body;

  try {
    const listing = await Property.findById(listingId);
    if (!listing) {
      return res.status(404).json({
        error: true,
        message: "The requested property listing could not be found.",
      });
    }
    const agent = await User.findById(listing.createdBy);
    if (!agent) {
      return res.status(404).json({
        error: true,
        message: "The requested property listing agent could not be found.",
      });
    }

    const existingEnquiry = await Enquiry.findOne({
      $or: [{ email: email }, { number: number }],
    });

    if (existingEnquiry) {
      return res.status(409).json({
        error: true,
        message: "You already have an existing enquiry on this property.",
      });
    }

    const ipAddress = req.ip;
    const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
    const data = await response.json();
    const country = data.country ? data.country : "Unknown";
    await Enquiry.create({
      name,
      email,
      medium,
      number,
      message,
      propertyId: listing._id,
      agentName: `${agent.firstname} ${agent.lastname || ""}`,
      agentImage: agent.profilePhoto.url,
      agentId: agent._id,
      country,
    });
    await Timestamp.findOneAndUpdate(
      { type: "enquiry" },
      { $set: { updatedAt: Date.now() } },
      {
        new: true,
        upsert: true,
      }
    );

    return res.status(200).json({
      error: false,
      message: "Your enquiry has been successfully sent!",
    });
  } catch (error) {
    console.error("Enquiry processing failed:", error);
    return res.status(500).json({
      error: true,
      message:
        " Failed to process your enquiry due to an internal server error.",
    });
  }
});
router.get("/fetch", verifyToken, async (req, res) => {
  const userRole = req.user.role;
  const UserId = req.user.id;
  let enquiries;
  try {
    if (userRole === "Admin") {
      enquiries = await Enquiry.find().sort({ createdAt: -1 });
    } else {
      enquiries = await Enquiry.find({ agentId: UserId }).sort({
        createdAt: -1,
      });
    }
    res.status(200).json(enquiries);
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Failed to fetch enquiries.",
    });
  }
});
router.get("/fetch/agent", verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const enquiries = await Enquiry.find({ agentId: userId }).sort({
      createdAt: -1,
    });
    res.status(200).json(enquiries);
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Failed to fetch enquiries.",
    });
  }
});
router.post("/delete", verifyToken, async (req, res) => {
  const { enquiryId } = req.body;
  try {
    const enquiryToDelete = await Enquiry.findByIdAndDelete(enquiryId);
    if (!enquiryToDelete) {
      return res.status(404).json({
        error: true,
        message: "The requested enquiry could not be found.",
      });
    }
    await Timestamp.findOneAndUpdate(
      { type: "enquiry" },
      { updatedAt: Date.now() },
      { new: true }
    );
    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    res.status(200).json({
      error: false,
      enquiries,
      lastUpdated: Date.now(),
    });
  } catch (error) {
    console.error(`Enquiry delete error:`, error);
    res.status(500).json({
      message: "Unable to delete enquiry. Please try again later.",
      error: error.message,
    });
  }
});
router.post("/mark-read", verifyToken, async (req, res) => {
  const { enquiryId } = req.body;
  try {
    const updatedEnquiry = await Enquiry.findByIdAndUpdate(
      enquiryId,
      { isRead: true },
      { new: true }
    );

    if (!updatedEnquiry) {
      return res.status(404).json({
        error: true,
        message: "The requested enquiry could not be found.",
      });
    }
    await Timestamp.findOneAndUpdate(
      { type: "enquiry" },
      { updatedAt: Date.now() },
      { new: true }
    );

    res.status(200).json({
      error: false,
      message: "Enquiry marked as read.",
      lastUpdated: Date.now(),
    });
  } catch (error) {
    console.error("Failed to mark enquiry as read:", error);
    res.status(500).json({
      error: true,
      message: "An unexpected error occurred on the server.",
    });
  }
});

export default router;
