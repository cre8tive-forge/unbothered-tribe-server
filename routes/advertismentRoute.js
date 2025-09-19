import express from "express";
import axios from "axios";
import { upload, uploadToCloudinary } from "../resources/multer.js";
import verifyToken from "../middleware/verifyToken.js";
import { Timestamp } from "../models/timestamps.js";
import { Advertisment } from "../models/advertisments.js";
import mongoose from "mongoose";
import { Transaction } from "../models/transactions.js";
import {
  adSubmissionMail,
  mailOptions,
  transporter,
} from "../config/nodemailer.js";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const verifyPaystackTransaction = async (reference) => {
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw new Error(`Paystack verification failed: ${error.message}`);
  }
};

router.post(
  "/store",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        fullname,
        company,
        email,
        number,
        link,
        adType,
        information,
        captchaToken,
        duration,
      } = req.body;

      const imageFile = req.files?.image?.[0];
      const bannerFile = req.files?.banner?.[0];

      if (!imageFile || !bannerFile) {
        return res.status(400).json({
          error: true,
          message: "Both the payment proof and banner image are required.",
        });
      }
      if (!fullname || !company || !email || !adType || !captchaToken) {
        return res.status(400).json({
          error: true,
          message:
            "Missing required fields: fullname, company, email, adType, or captcha token.",
        });
      }
      const secretKey = process.env.RECAPTCHA_SECRET_KEY;
      const captchaResponse = await axios.post(
        `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`
      );
      const captchaData = captchaResponse.data;

      if (!captchaData.success) {
        return res.status(401).json({
          error: true,
          message: "Recaptcha verification failed. Please try again.",
        });
      }

      // Get IP location
      const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
      let country = "Unknown";

      try {
        const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
        const data = await response.json();
        country = data.country || "Unknown";
      } catch (geoError) {
        console.log("Geo-location failed:", geoError.message);
      }

      // Upload images to Cloudinary
      const [imageUrl, bannerUrl] = await Promise.all([
        uploadToCloudinary(imageFile.buffer),
        uploadToCloudinary(bannerFile.buffer),
      ]);

      if (!imageUrl || !bannerUrl) {
        return res.status(500).json({
          error: true,
          message: "Failed to upload one or more images.",
        });
      }

      const advertisement = await Advertisment.create({
        fullname,
        company,
        email,
        number,
        country,
        link,
        adType,
        information,
        duration: duration || "1 Month",
        image: imageUrl,
        banner: bannerUrl,
        status: "pending",
      });

      try {
        await transporter.sendMail({
          ...mailOptions,
          to: email,
          subject: "📢 Your Advertisement Has Been Submitted",
          html: adSubmissionMail
            .replace(/{{FULLNAME}}/g, fullname || "User")
            .replace(/{{COMPANY}}/g, company || "N/A")
            .replace(/{{EMAIL}}/g, email || "N/A")
            .replace(/{{NUMBER}}/g, number || "N/A")
            .replace(/{{ADTYPE}}/g, adType || "General")
            .replace(/{{LINK}}/g, link || "No link provided")
            .replace(/{{INFORMATION}}/g, information || "No details provided"),
        });
      } catch (emailError) {
        console.error("Failed to send confirmation email:", emailError);
        // Don't fail the request if email fails
      }

      // Update timestamp
      await Timestamp.findOneAndUpdate(
        { type: "advertisment" },
        { $set: { updatedAt: Date.now() } },
        { new: true, upsert: true }
      );

      return res.status(201).json({
        error: false,
        message:
          "Advertisement submitted successfully. You will be notified once it's reviewed.",
        advertisementId: advertisement._id,
      });
    } catch (err) {
      console.error("Error processing advertisement upload:", err);
      res.status(500).json({
        error: true,
        message: "Unable to process your request. Please try again.",
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  }
);

router.get("/fetch", verifyToken, async (req, res) => {
  try {
    const advertisements = await Advertisment.find().sort({ createdAt: -1 });
    res.status(200).json(advertisements);
  } catch (err) {
    console.error("Error fetching advertisements:", err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch advertisements.",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

router.get("/fetch/:id", async (req, res) => {
  try {
    const position = req.params.id;

    if (!position) {
      return res.status(400).json({
        error: true,
        message: "Position parameter is required.",
      });
    }

    const ads = await Advertisment.find({
      status: "active",
      position: position,
      $or: [
        { expiryDate: { $gt: new Date() } },
        { expiryDate: { $exists: false } },
      ],
    })
      .select("banner link company adType createdAt expiryDate")
      .sort({ createdAt: -1 });

    return res.status(200).json(ads);
  } catch (err) {
    console.error("Error fetching position advertisements:", err);
    res.status(500).json({
      error: true,
      message: "Failed to fetch advertisements.",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// Delete advertisement (Admin only)
router.post("/delete", verifyToken, async (req, res) => {
  try {
    const { advertismentId } = req.body;

    if (!advertismentId) {
      return res.status(400).json({
        error: true,
        message: "Advertisement ID is required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(advertismentId)) {
      return res.status(400).json({
        error: true,
        message: "Invalid advertisement ID format.",
      });
    }

    if (req.user.role !== "Admin") {
      return res.status(403).json({
        error: true,
        message: "Not authorized to delete advertisements.",
      });
    }

    const advertisementToDelete = await Advertisment.findById(advertismentId);
    if (!advertisementToDelete) {
      return res.status(404).json({
        error: true,
        message: "Advertisement record not found.",
      });
    }

    // Delete images from Cloudinary
    try {
      if (advertisementToDelete.image?.public_id) {
        await cloudinary.uploader.destroy(
          advertisementToDelete.image.public_id
        );
      }
      if (advertisementToDelete.banner?.public_id) {
        await cloudinary.uploader.destroy(
          advertisementToDelete.banner.public_id
        );
      }
    } catch (cloudinaryError) {
      console.error(
        "Failed to delete images from Cloudinary:",
        cloudinaryError
      );
    }

    const advertisments = await Advertisment.findByIdAndDelete(advertismentId);

    await Timestamp.findOneAndUpdate(
      { type: "advertisment" },
      { updatedAt: Date.now() },
      { new: true, upsert: true }
    );

    res.status(200).json({
      error: false,
      message: "Advertisement deleted successfully.",
      advertisments: advertisments,
      lastUpdated: Date.now(),
    });
  } catch (err) {
    console.error("Error deleting advertisement:", err);
    res.status(500).json({
      error: true,
      message: "Unable to delete advertisement. Please try again.",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// Update advertisement status (Admin only)
router.put("/status", verifyToken, async (req, res) => {
  try {
    const { advertismentId, status } = req.body;

    if (!advertismentId || !status) {
      return res.status(400).json({
        error: true,
        message: "Advertisement ID and status are required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(advertismentId)) {
      return res.status(400).json({
        error: true,
        message: "Invalid advertisement ID.",
      });
    }

    const validStatuses = [
      "pending",
      "approved",
      "rejected",
      "active",
      "inactive",
      "expired",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: true,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    if (req.user.role !== "Admin") {
      return res.status(403).json({
        error: true,
        message: "Not authorized to update advertisement status.",
      });
    }

    const advertisement = await Advertisment.findById(advertismentId);
    if (!advertisement) {
      return res.status(404).json({
        error: true,
        message: "Advertisement not found.",
      });
    }

    const updatedAdvertisement = await Advertisment.findByIdAndUpdate(
      advertismentId,
      { status: status },
      { new: true }
    );

    await Timestamp.findOneAndUpdate(
      { type: "advertisment" },
      { updatedAt: Date.now() },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      error: false,
      message: "Advertisement status updated successfully.",
      advertisement: updatedAdvertisement,
    });
  } catch (err) {
    console.error("Error updating advertisement status:", err);
    res.status(500).json({
      error: true,
      message: "Unable to update advertisement status. Please try again.",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// Activate advertisement with position (Admin only)
router.post("/activate", verifyToken, async (req, res) => {
  try {
    const { advertismentId, position } = req.body;

    if (!advertismentId || !position) {
      return res.status(400).json({
        error: true,
        message: "Advertisement ID and position are required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(advertismentId)) {
      return res.status(400).json({
        error: true,
        message: "Invalid advertisement ID.",
      });
    }

    if (req.user.role !== "Admin") {
      return res.status(403).json({
        error: true,
        message: "Not authorized to activate advertisements.",
      });
    }

    const advertisement = await Advertisment.findById(advertismentId);
    if (!advertisement) {
      return res.status(404).json({
        error: true,
        message: "Advertisement not found.",
      });
    }

    // Check if position is already taken
    const positionTaken = await Advertisment.findOne({
      position: position,
      status: "active",
      _id: { $ne: advertismentId }, // Exclude current ad
    });

    if (positionTaken) {
      return res.status(409).json({
        error: true,
        message: "Advertisement placement position is already taken.",
        conflictingAd: {
          id: positionTaken._id,
          company: positionTaken.company,
        },
      });
    }

    // Calculate expiry date based on duration
    let durationInDays;
    switch (advertisement.duration) {
      case "1 Month":
        durationInDays = 30;
        break;
      case "2 Months":
        durationInDays = 60;
        break;
      case "3 Months":
        durationInDays = 90;
        break;
      default:
        durationInDays = 30;
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + durationInDays);

    const updatedAdvertisement = await Advertisment.findByIdAndUpdate(
      advertismentId,
      {
        position: position,
        status: "active",
        startDate: new Date(),
        expiryDate: expiryDate,
      },
      { new: true }
    );

    await Timestamp.findOneAndUpdate(
      { type: "advertisment" },
      { updatedAt: Date.now() },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      error: false,
      message: "Advertisement activated successfully.",
      advertisement: updatedAdvertisement,
    });
  } catch (err) {
    console.error("Error activating advertisement:", err);
    res.status(500).json({
      error: true,
      message: "Unable to activate advertisement. Please try again.",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// Process payment verification
router.post("/process-payment", async (req, res) => {
  try {
    const { reference, email, plan, amount, currency, transactionId } =
      req.body;

    // Validate required fields
    if (!reference || !plan || !email || !amount || !currency) {
      return res.status(400).json({
        error: true,
        message:
          "Missing required payment details: reference, plan, email, amount, or currency.",
      });
    }

    // Verify transaction with Paystack
    const verificationResponse = await verifyPaystackTransaction(reference);

    if (!verificationResponse.status || !verificationResponse.data) {
      return res.status(400).json({
        error: true,
        message:
          "Payment verification failed. Invalid response from payment provider.",
      });
    }

    const verifiedData = verificationResponse.data;
    const paidAmount = verifiedData.amount / 100; // Convert from kobo to naira
    const expectedAmount = parseFloat(amount);

    // Validate payment success and amount
    if (verifiedData.status !== "success") {
      return res.status(400).json({
        error: true,
        message: "Payment was not successful. Please try again.",
        paymentStatus: verifiedData.status,
      });
    }

    if (paidAmount !== expectedAmount) {
      return res.status(400).json({
        error: true,
        message: "Payment amount mismatch. Please contact support.",
        expected: expectedAmount,
        paid: paidAmount,
      });
    }

    // Check if transaction already exists
    const existingTransaction = await Transaction.findOne({
      reference: verifiedData.reference,
    });

    if (existingTransaction) {
      return res.status(409).json({
        error: true,
        message: "This payment has already been processed.",
        transactionId: existingTransaction._id,
      });
    }

    // Save transaction to database
    const transaction = await Transaction.create({
      transactionId: verifiedData.id,
      amount: paidAmount,
      currency: verifiedData.currency,
      status: verifiedData.status,
      plan: plan,
      reference: verifiedData.reference,
      email: email,
      paidAt: new Date(verifiedData.paid_at),
      channel: verifiedData.channel,
      fees: verifiedData.fees ? verifiedData.fees / 100 : 0,
      customerCode: verifiedData.customer?.customer_code,
      authorizationCode: verifiedData.authorization?.authorization_code,
      metadata: verifiedData.metadata || {},
    });

    // Update timestamp
    await Timestamp.findOneAndUpdate(
      { type: "transaction" },
      { $set: { updatedAt: Date.now() } },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      error: false,
      message: "Payment verified and processed successfully.",
      transactionId: transaction._id,
      reference: verifiedData.reference,
    });
  } catch (error) {
    console.error("Payment processing error:", error);

    // Determine appropriate error message
    let errorMessage = "Payment processing failed. Please try again.";
    let statusCode = 500;

    if (error.message.includes("Paystack verification failed")) {
      errorMessage =
        "Payment verification failed. Please contact support if you were charged.";
      statusCode = 400;
    } else if (error.message.includes("Network Error")) {
      errorMessage =
        "Network error during payment verification. Please try again.";
      statusCode = 503;
    }

    return res.status(statusCode).json({
      error: true,
      message: errorMessage,
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Test Paystack connection (Development/Admin only)
router.get("/test-paystack", verifyToken, async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production" && req.user.role !== "Admin") {
      return res.status(403).json({
        error: true,
        message: "Not authorized to access this endpoint.",
      });
    }

    // Test Paystack API connection
    const testResponse = await axios.get("https://api.paystack.co/bank", {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    res.json({
      error: false,
      message: "Paystack connection successful",
      api_available: testResponse.status === 200,
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    console.error("Paystack connection test failed:", error);
    res.status(500).json({
      error: true,
      message: "Paystack connection test failed",
      details: error.message,
    });
  }
});

// Get expired advertisements (Cron job endpoint)
router.get("/expired", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        error: true,
        message: "Not authorized to access this endpoint.",
      });
    }

    const expiredAds = await Advertisment.find({
      status: "active",
      expiryDate: { $lte: new Date() },
    });

    // Update expired advertisements
    if (expiredAds.length > 0) {
      await Advertisment.updateMany(
        { _id: { $in: expiredAds.map((ad) => ad._id) } },
        { status: "expired" }
      );

      await Timestamp.findOneAndUpdate(
        { type: "advertisment" },
        { updatedAt: Date.now() },
        { new: true, upsert: true }
      );
    }

    res.json({
      error: false,
      message: `Found and updated ${expiredAds.length} expired advertisements`,
      expiredCount: expiredAds.length,
      expiredAds: expiredAds.map((ad) => ({
        id: ad._id,
        company: ad.company,
        position: ad.position,
        expiryDate: ad.expiryDate,
      })),
    });
  } catch (error) {
    console.error("Error processing expired advertisements:", error);
    res.status(500).json({
      error: true,
      message: "Failed to process expired advertisements",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

export default router;
