import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import { User } from "../models/users.js";
import mongoose from "mongoose";
import { Review } from "../models/reviews.js";
import { Enquiry } from "../models/enquiries.js";
import { Property } from "../models/property.js";
import { Timestamp } from "../models/timestamps.js";
import cloudinary from "../config/cloudinary.js";
import {
  kycApprovedMail,
  mailOptions,
  transporter,
} from "../config/nodemailer.js";
import { Transaction } from "../models/transactions.js";
import { Subscription } from "../models/subscriptions.js";
const router = express.Router();

router.get("/fetch", async (req, res) => {
  try {
    const agents = await User.find({
      role: "Agent",
      kycStatus: "verified",
      status: "active",
    })
      .sort({
        createdAt: -1,
      })
      .select("-password");
    res.status(200).json(agents);
  } catch (err) {
    console.error("Failed to fetch agents:", err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch agents.",
    });
  }
});
router.get("/fetch/admin", verifyToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const agents = await User.find({
      role: "Agent",
      _id: { $ne: currentUserId },
    })
      .sort({
        createdAt: -1,
      })
      .select("-password");
    res.status(200).json(agents);
  } catch (err) {
    console.error("Failed to fetch agents:", err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch agents.",
    });
  }
});
router.get("/fetch/admin/order", verifyToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const agents = await User.find({
      role: "Agent",
      _id: { $ne: currentUserId },
    })
      .sort({ totalListing: -1 })
      .select("-password");

    res.status(200).json(agents);
  } catch (err) {
    console.error("Failed to fetch agents:", err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch agents.",
    });
  }
});
router.post("/edit/save", verifyToken, async (req, res) => {
  const {
    firstname,
    middlename,
    lastname,
    number,
    email,
    role,
    status,
    agentId,
    kycStatus,
  } = req.body;
  try {
    const user = await User.findById(agentId);
    if (!user) {
      return res.status(404).json({
        error: true,
        message: "The requested agent could not be found.",
      });
    }

    const existingUser = await User.findOne({
      _id: { $ne: agentId },
      $or: [{ email: email }, { number: number }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(409).json({
          error: true,
          message: "This email address already exists.",
        });
      }
      if (existingUser.number === number) {
        return res.status(409).json({
          error: true,
          message: "This phone number already exists.",
        });
      }
    }
    if (user.kycStatus !== "verified" && kycStatus === "verified") {
      await transporter.sendMail({
        ...mailOptions,
        subject: `KYC Verification Approved`,
        to: email,
        html: kycApprovedMail
          .replace(/{{FIRSTNAME}}/g, firstname)
          .replace(/{{LASTNAME}}/g, ""),
      });
    }
    await User.findByIdAndUpdate(
      agentId,
      {
        firstname,
        middlename,
        lastname,
        number,
        email,
        role,
        status,
        kycStatus,
      },
      { new: true }
    );

    await Timestamp.findOneAndUpdate(
      { type: "user" },
      { updatedAt: Date.now() },
      { new: true }
    );
    const currentUserId = req.user.id;
    const agents = await User.find({
      role: "Agent",
      _id: { $ne: currentUserId },
    })
      .sort({
        createdAt: -1,
      })
      .select("-password");
    res.status(200).json({
      error: false,
      agents,
      message: "Agent details updated successfully",
      lastUpdated: Date.now(),
    });
  } catch (error) {
    console.error("Failed to edit agent details:", error);
    res.status(500).json({
      error: true,
      message: "Failed to edit agent details.",
    });
  }
});
router.post("/delete", verifyToken, async (req, res) => {
  const { agentId } = req.body;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    await Review.deleteMany({ agent: agentId }, { session });
    await Review.deleteMany({ user: agentId }, { session });
    await Transaction.deleteMany({ userId: agentId }, { session });
    await Subscription.deleteMany({ userId: agentId }, { session });
    await Report.deleteMany({ agent: agentId }, { session });
    await Enquiry.deleteMany({ agentId: agentId }, { session });

    const listings = await Property.find({ createdBy: agentId }).session(
      session
    );
    const publicIds = listings.flatMap((l) =>
      l.images.map((img) => img.public_id)
    );

    await Property.deleteMany({ createdBy: agentId }, { session });

    const deletedUser = await User.findByIdAndDelete(agentId, { session });
    if (!deletedUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        error: true,
        message: "The requested user could not be found.",
      });
    }

    await Timestamp.updateMany(
      { type: { $in: ["user", "review", "enquiry"] } },
      { $set: { updatedAt: Date.now() } }
    );
    await session.commitTransaction();
    session.endSession();

    if (publicIds.length > 0) {
      try {
        await Promise.all(
          publicIds.map((id) => cloudinary.uploader.destroy(id))
        );
      } catch (cloudErr) {
        console.error("Cloudinary cleanup failed:", cloudErr);
      }
    }

    const currentagentId = req.user.id;
    const users = await User.find({ _id: { $ne: currentagentId } })
      .sort({ createdAt: -1 })
      .select("-password");

    res.status(200).json({
      error: false,
      users,
      message: "User deleted successfully",
      lastUpdated: Date.now(),
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("User delete error:", error);
    res.status(500).json({
      message: "Unable to delete User. Please try again later.",
      error: error.message,
    });
  }
});
router.get("/fetch/single/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const agent = await User.findOneAndUpdate(
      { _id: id },
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!agent) {
      return res
        .status(404)
        .json({ error: true, message: "Agent record not found." });
    }
    const listings = await Property.find({
      createdBy: agent._id,
      status: "active",
    }).sort({
      createdAt: -1,
    });
    return res.json({ agent, listings });
  } catch (error) {
    console.error("Error fetching agent's details:", error);
    res.status(500).json({
      error: true,
      message: "Unable to fetch agent's details. Please try again.",
    });
  }
});
export default router;
