import express from "express";
import {
  deleteFromCloudinary,
  upload,
  uploadToCloudinary,
} from "../resources/multer.js";
import { Property } from "../models/property.js";
import verifyToken from "../middleware/verifyToken.js";
import cloudinary from "../config/cloudinary.js";
import { User } from "../models/users.js";
import { Review } from "../models/reviews.js";
import { Enquiry } from "../models/enquiries.js";
import mongoose from "mongoose";
import { Timestamp } from "../models/timestamps.js";

const router = express.Router();
router.post("/store", verifyToken, upload.array("images"), async (req, res) => {
  const userId = req.user.id;
  if (req.user.role === "User") {
    return res
      .status(403)
      .json({ error: true, message: "Not authorized to edit this listing" });
  }
  try {
    const {
      title,
      purpose,
      location,
      category,
      subCategory,
      price,
      denomination,
      installmentPayment,
      appendTo,
      bedrooms,
      bathrooms,
      toilets,
      areaSize,
      description,
      features,
      youtubeVideo,
      instagramVideo,
      virtualTour,
    } = req.body;

    const parsedLocation = JSON.parse(location);
    const imageUrls = await Promise.all(
      req.files.map((file) => uploadToCloudinary(file.buffer))
    );

    const newProperty = await Property.create({
      title,
      purpose,
      location: parsedLocation,
      category,
      subCategory,
      price,
      denomination,
      installmentPayment: installmentPayment === "true",
      appendTo,
      bedrooms,
      createdBy: userId,
      bathrooms,
      toilets,
      areaSize,
      description,
      features: features,
      youtubeVideo,
      instagramVideo,
      virtualTour,
      images: imageUrls,
      averageRating: 0,
      ratingCount: 0,
    });
    await User.findOneAndUpdate(
      { _id: userId },
      { $inc: { totalisting: 1 } },
      { new: true }
    );
    await Timestamp.findOneAndUpdate(
      { type: "listing" },
      { $set: { updatedAt: Date.now() } },
      {
        new: true,
        upsert: true,
      }
    );

    return res.status(201).json({
      error: false,
      message: "Property listing created successfully.",
      property: newProperty,
    });
  } catch (err) {
    console.error("Error creating property listing:", err);
    res.status(500).json({
      error: true,
      message: "Unable to create property listing. Please try again.",
      details: err.message,
    });
  }
});
router.get("/fetch", async (req, res) => {
  try {
    const listings = await Property.find({ status: "active" })
      .populate("createdBy", "profilePhoto _id firstname lastname number")
      .sort({
        createdAt: -1,
      });
    res.status(200).json(listings);
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Failed to fetch listings.",
    });
  }
});
router.get("/fetch/dashboard", verifyToken, async (req, res) => {
  try {
    const listings = await Property.find().sort({
      createdAt: -1,
    });
    res.status(200).json(listings);
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Failed to fetch listings.",
    });
  }
});
router.get("/fetch/agent", verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const listings = await Property.find({
      createdBy: userId,
    }).sort({
      createdAt: -1,
    });
    res.status(200).json(listings);
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Failed to fetch listings.",
    });
  }
});
router.get("/fetch/:id", async (req, res) => {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid listing ID." });
    }

    const listing = await Property.findOneAndUpdate(
      { _id: id },
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!listing) {
      return res
        .status(404)
        .json({ error: true, message: "Listing record not found." });
    }
    if (listing.status !== "active") {
      return res.status(401).json({
        error: true,
        message: "Listing currently not available to view",
      });
    }

    const agent = await User.findById(listing.createdBy).select("-password");
    if (!agent) {
      return res
        .status(401)
        .json({ error: true, message: "Unidentified agent" });
    }

    const reviews = await Review.find({ property: listing._id })
      .populate("user", "profilePhoto firstname lastname role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      error: false,
      listing,
      agent,
      reviews,
    });
  } catch (error) {
    console.error("Error fetching listing:", error);
    res.status(500).json({
      error: true,
      message: "Unable to fetch listing. Please try again.",
    });
  }
});
router.get("/fetch/purpose/:id", async (req, res) => {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid listing ID." });
    }

    const listing = await Property.findOneAndUpdate(
      { _id: id },
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!listing) {
      return res
        .status(404)
        .json({ error: true, message: "Listing record not found." });
    }

    const agent = await User.findById(listing.createdBy).select(
      "firstname lastname profilePhoto role"
    );
    if (!agent) {
      return res
        .status(401)
        .json({ error: true, message: "Unidentified agent" });
    }

    const reviews = await Review.find({ property: listing._id })
      .populate("user", "profilePhoto firstname lastname role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      error: false,
      listing,
      agent,
      reviews,
    });
  } catch (error) {
    console.error("Error fetching listing:", error);
    res.status(500).json({
      error: true,
      message: "Unable to fetch listing. Please try again.",
    });
  }
});
router.get("/fetch/protected/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid listing ID." });
    }
    if (req.user.role === "User") {
      return res
        .status(403)
        .json({ error: true, message: "Not authorized to edit this listing" });
    }
    const listing = await Property.findById(id);
    if (!listing) {
      return res
        .status(404)
        .json({ error: true, message: "Listing record not found." });
    }
    res.status(200).json({
      error: false,
      listing,
    });
  } catch (error) {
    console.error("Error fetching listing:", error);
    res.status(500).json({
      error: true,
      message: "Unable to fetch listing. Please try again.",
    });
  }
});
router.put("/:id/status", verifyToken, async (req, res) => {
  try {
    const listingId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid listing ID." });
    }

    const listing = await Property.findById(listingId);
    if (!listing) {
      return res
        .status(404)
        .json({ error: true, message: "Listing not found." });
    }
    if (
      listing.createdBy.toString() !== req.user.id &&
      req.user.role !== "Admin"
    ) {
      return res
        .status(403)
        .json({ error: true, message: "Not authorized to update status." });
    }

    const { status } = req.body;
    const validStatuses = ["active", "archived", "sold", "rented", "pending"];
    const specialStatuses = ["featured", "homepage", "removeFromHomepage"];

    if (!validStatuses.includes(status) && !specialStatuses.includes(status)) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid status provided." });
    }
    await Timestamp.updateMany(
      { type: { $in: ["listing", "favourite"] } },
      { $set: { updatedAt: Date.now() } }
    );

    if (validStatuses.includes(status)) {
      const updatedListing = await Property.findByIdAndUpdate(
        listingId,
        { status },
        { new: true }
      );

      return res.status(200).json({
        error: false,
        message: "Listing status updated successfully.",
        listing: updatedListing,
      });
    }

    if (status === "featured") {
      await Property.updateMany(
        { isFeatured: true },
        { $set: { isFeatured: false } }
      );
      const updatedListing = await Property.findByIdAndUpdate(
        listingId,
        { isFeatured: true },
        { new: true }
      );
      return res.status(200).json({
        error: false,
        message: "Listing successfully set as featured.",
        listing: updatedListing,
      });
    }

    if (status === "homepage") {
      const homepageCount = await Property.countDocuments({ onHomepage: true });
      if (homepageCount >= 10) {
        return res.status(400).json({
          error: true,
          message:
            "Cannot add listing to homepage, 10 listings are already featured on the homepage.",
        });
      }
      const updatedListing = await Property.findByIdAndUpdate(
        listingId,
        { onHomepage: true },
        { new: true }
      );
      return res.status(200).json({
        error: false,
        message: "Listing successfully added to homepage.",
        listing: updatedListing,
      });
    }

    if (status === "removeFromHomepage") {
      const updatedListing = await Property.findByIdAndUpdate(
        listingId,
        { onHomepage: false },
        { new: true }
      );
      return res.status(200).json({
        error: false,
        message: "Listing successfully removed from homepage.",
        listing: updatedListing,
      });
    }
  } catch (err) {
    console.error("Error updating listing status:", err);
    res.status(500).json({
      error: true,
      message: "Unable to update listing status. Please try again.",
      details: err.message,
    });
  }
});
router.post("/delete", verifyToken, async (req, res) => {
  try {
    const { listingId } = req.body;
    const listingToDelete = await Property.findById(listingId);
    if (!listingToDelete) {
      return res
        .status(404)
        .json({ error: true, message: "Listing not found." });
    }

    const publicIds = listingToDelete.images.map((img) => img.public_id);
    await Promise.all(publicIds.map((id) => cloudinary.uploader.destroy(id)));

    await User.findOneAndUpdate(
      { _id: listingToDelete.createdBy, totalisting: { $gt: 0 } },
      { $inc: { totalisting: -1 } },
      { new: true }
    );

    await Enquiry.deleteMany({ propertyId: listingId });
    await Review.deleteMany({ property: listingId });

    await User.updateMany(
      { favoriteListings: { $in: [listingId] } },
      { $pull: { favoriteListings: listingId } }
    );
    await Property.findByIdAndDelete(listingId);

    await Timestamp.updateMany(
      { type: { $in: ["user", "review", "enquiry", "listing", "favourite"] } },
      { $set: { updatedAt: Date.now() } }
    );

    const listings = await Property.find().sort({ createdAt: -1 });

    res.status(200).json({
      error: false,
      message: "Listing deleted successfully.",
      listings,
      lastUpdated: Date.now(),
    });
  } catch (err) {
    console.error("Error deleting listing:", err);
    res.status(500).json({
      error: true,
      message: "Unable to delete listing. Please try again.",
      details: err.message,
    });
  }
});

router.put(
  "/update/:id",
  verifyToken,
  upload.array("images"),
  async (req, res) => {
    const userId = req.user.id;
    const listingId = req.params.id;

    try {
      const listing = await Property.findById(listingId);

      if (!listing) {
        return res.status(404).json({
          error: true,
          message: "Listing not found.",
        });
      }

      if (
        listing.createdBy.toString() !== userId &&
        req.user.role !== "Admin" &&
        req.user.role !== "Agent"
      ) {
        return res.status(403).json({
          error: true,
          message: "Not authorized to update this listing.",
        });
      }

      const {
        title,
        purpose,
        location,
        category,
        subCategory,
        price,
        denomination,
        installmentPayment,
        appendTo,
        bedrooms,
        bathrooms,
        toilets,
        areaSize,
        description,
        features,
        youtubeVideo,
        instagramVideo,
        virtualTour,
        existingImages,
      } = req.body;

      const parsedLocation = JSON.parse(location);
      const parsedExistingImages = JSON.parse(existingImages || "[]");

      let newImageUrls = [];
      if (req.files && req.files.length > 0) {
        newImageUrls = await Promise.all(
          req.files.map((file) => uploadToCloudinary(file.buffer))
        );
      }

      // 1. Correctly filter images to delete based on public_id
      const imagesToDelete = listing.images.filter(
        (img) =>
          !parsedExistingImages.some(
            (existingImg) => existingImg.public_id === img.public_id
          )
      );

      if (imagesToDelete.length > 0) {
        await Promise.all(
          imagesToDelete.map((img) => deleteFromCloudinary(img.public_id))
        );
      }

      // 2. Combine the kept existing images (in object format) with the new ones
      const finalImages = [...parsedExistingImages, ...newImageUrls];

      const updatedProperty = await Property.findByIdAndUpdate(
        listingId,
        {
          title,
          purpose,
          location: parsedLocation,
          category,
          subCategory,
          price,
          denomination,
          installmentPayment: installmentPayment === "true",
          appendTo,
          bedrooms,
          bathrooms,
          toilets,
          areaSize,
          description,
          features: features,
          youtubeVideo,
          instagramVideo,
          virtualTour,
          images: finalImages, // This array now contains objects, which Mongoose expects
        },
        {
          new: true,
        }
      );

      await Timestamp.findOneAndUpdate(
        { type: "listing" },
        { $set: { updatedAt: Date.now() } },
        { new: true, upsert: true }
      );

      return res.status(200).json({
        error: false,
        message: "Property listing updated successfully.",
        property: updatedProperty,
      });
    } catch (err) {
      console.error("Error updating property listing:", err);
      res.status(500).json({
        error: true,
        message: "Unable to update property listing. Please try again.",
        details: err.message,
      });
    }
  }
);
export default router;
