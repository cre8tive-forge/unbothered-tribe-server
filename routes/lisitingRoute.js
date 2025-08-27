import express from "express";
import {
  getPublicIdFromUrl,
  upload,
  uploadToCloudinary,
} from "../resources/multer.js";
import { Property } from "../models/property.js";
import verifyToken from "../middleware/verifyToken.js";
import cloudinary from "../config/cloudinary.js";
import { User } from "../models/users.js";
import { Review } from "../models/reviews.js";
const router = express.Router();

router.post("/store", verifyToken, upload.array("images"), async (req, res) => {
  const userId = req.user.id;
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

    console.log(userId);
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
    });

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
    const listings = await Property.find().sort({ createdAt: -1 });

    res.status(200).json(listings);
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Failed to fetch listings.",
    });
  }
});

router.get("/last-updated", async (req, res) => {
  try {
    const latest = await Property.findOne().sort({ createdAt: -1 });
    res.json({ lastUpdated: latest?.createdAt?.getTime() || Date.now() });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

router.get("/fetch/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const listing = await Property.findOne({ _id: id });
    if (!listing) {
      return res
        .status(404)
        .json({ error: true, message: "Listing record not found." });
    }
    const agent = await User.findById(listing.createdBy);
    if (!agent) {
      return res
        .status(401)
        .json({ error: true, message: "Unidentified agent" });
    }
    const reviews = await Review.find({ property: listing._id }).sort({
      createdAt: -1,
    });

    res.status(200).json({ listing, agent, reviews });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

router.get("/last-updated/:id", async (req, res) => {
  const { id } = req.params;
  console.log({ id });
  try {
    const listing = await Property.findOne({ _id: id });
    if (!listing) {
      return res
        .status(404)
        .json({ error: true, message: "Listing record not found." });
    }
    res.json({ lastUpdated: listing?.updatedAt?.getTime() || Date.now() });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

router.put("/:id/status", verifyToken, async (req, res, next) => {
  try {
    const listingId = req.params.id;
    const { status } = req.body;
    const validStatuses = ["active", "archived", "sold", "rented", "pending"];
    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid status provided." });
    }

    const updatedListing = await Property.findByIdAndUpdate(
      listingId,
      { status },
      { new: true }
    );

    if (!updatedListing) {
      return res
        .status(404)
        .json({ error: true, message: "Listing not found." });
    }

    res.status(200).json({
      error: false,
      message: "Listing status updated successfully.",
      listing: updatedListing,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/delete", verifyToken, async (req, res, next) => {
  try {
    const { listingId } = req.body;

    const listingToDelete = await Property.findById(listingId);
    if (!listingToDelete) {
      return res
        .status(404)
        .json({ error: true, message: "Listing not found." });
    }

    const publicIds = listingToDelete.images.map(getPublicIdFromUrl);
    await Promise.all(
      publicIds.map((publicId) => cloudinary.uploader.destroy(publicId))
    );
    const deletedListing = await Property.findByIdAndDelete(listingId);

    const latestListing = await Property.findOne().sort({ createdAt: -1 });
    if (latestListing) {
      latestListing.updatedAt = new Date();
      await latestListing.save();
    }
    const listings = await Property.find().sort({ createdAt: -1 });

    res.status(200).json({
      error: false,
      message: "Listing deleted successfully.",
      listings,
      lastUpdated: Date.now(),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/favorites/add", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { listingId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: true, message: "User not found." });
    }

    if (user.favoriteListings.includes(listingId)) {
      return res.status(401).json({
        error: true,
        message: "Listing already saved to your wishlist",
      });
    } else {
      user.favoriteListings.push(listingId);
      user.updatedAt = Date.now();
      await user.save();
      res.status(200).json({
        error: false,
        message: "Listing added to favorites successfully.",
      });
    }
  } catch (err) {
    res.status(500).json({
      message: "Unable to add listing to favourites",
      error: err.message,
    });
  }
});
export default router;
