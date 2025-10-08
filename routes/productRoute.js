import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import { Product } from "../models/products.js";
import cloudinary from "../config/cloudinary.js";
import { User } from "../models/users.js";
import { Timestamp } from "../models/timestamps.js";
import mongoose from "mongoose";
import { upload, uploadToCloudinary } from "../resources/multer.js";
const router = express.Router();
import slugify from "slugify";
import { nanoid } from "nanoid";

router.post(
  "/upload",
  verifyToken,
  upload.array("images"),
  async (req, res) => {
    if (req.user.role !== "Admin") {
      return res
        .status(403)
        .json({ error: true, message: "Not authorized to upload product" });
    }

    try {
      const {
        name,
        regularPrice,
        salePrice,
        quantity,
        category,
        subCategory,
        inStock,
        sale,
        isFeatured,
        sizes,
        description,
      } = req.body;
      const slug = `${nanoid(20)}${slugify(name, {
        lower: true,
        strict: true,
      })}`;
      const parsedDescription = JSON.parse(description);
      const imageUrls = await Promise.all(
        req.files.map((file) => uploadToCloudinary(file.buffer))
      );

      const newProduct = await Product.create({
        name,
        slug,
        regularPrice,
        salePrice,
        quantity,
        category,
        subCategory,
        description: parsedDescription,
        sizes: sizes,
        inStock,
        sale,
        isFeatured,
        images: imageUrls,
      });

      await Timestamp.findOneAndUpdate(
        { type: "product" },
        { $set: { updatedAt: Date.now() } },
        {
          new: true,
          upsert: true,
        }
      );

      return res.status(201).json({
        error: false,
        message: "Product uploaded successfully.",
        property: newProduct,
      });
    } catch (err) {
      console.error("Error uploading Product:", err);
      res.status(500).json({
        error: true,
        message: "Unable to upload Product. Please try again.",
        details: err.message,
      });
    }
  }
);
router.get("/fetch", async (req, res) => {
  try {
    const products = await Product.find({ status: "available" }).sort({
      createdAt: -1,
    });
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Failed to fetch products.",
    });
  }
});
router.get("/fetch/admin", verifyToken, async (req, res) => {
  try {
    const products = await Product.find().sort({
      createdAt: -1,
    });
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Failed to fetch products.",
    });
  }
});

router.post("/delete", verifyToken, async (req, res) => {
  const { productId } = req.body;
  if (req.user.role !== "Admin") {
    return res.status(400).json({
      error: true,
      message: "You are not authorized to perform this action",
    });
  }
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      error: true,
      message: "Invalid product ID.",
    });
  }

  try {
    const productToDelete = await Product.findById(productId);
    if (!productToDelete) {
      return res.status(404).json({
        error: true,
        message: "Product not found.",
      });
    }

    const publicIds = productToDelete.images.map((img) => img.public_id);
    await Promise.all(publicIds.map((id) => cloudinary.uploader.destroy(id)));

    await User.updateMany(
      { wishlist: productId },
      { $pull: { wishlist: productId } }
    );

    await Product.findByIdAndDelete(productId);

    await Timestamp.updateMany(
      { type: { $in: ["user", "product"] } },
      { $set: { updatedAt: new Date() } }
    );

    const products = await Product.find().sort({ createdAt: -1 });
    const lastUpdated = Date.now();

    res.status(200).json({
      error: false,
      message: "Product deleted successfully.",
      products,
      lastUpdated,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      error: true,
      message: "Failed to delete product.",
      details: err.message,
    });
  }
});
router.post("/verify", verifyToken, async (req, res) => {
  const { productId } = req.body;
  if (req.user.role !== "Admin") {
    return res.status(400).json({
      error: true,
      message: "You are not authorized to perform this action",
    });
  }
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      error: true,
      message: "Invalid product ID.",
    });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        error: true,
        message: "Product not found.",
      });
    }

    res.status(200).json({
      error: false,
      message: "Edit page redirect successful.",
      product: product._id,
      lastUpdated,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      error: true,
      message: "Failed to delete product.",
      details: err.message,
    });
  }
});
router.put("/status", verifyToken, async (req, res) => {
  const { productId, status } = req.body;

  try {
    if (req.user.role !== "Admin") {
      return res.status(400).json({
        error: true,
        message: "You are not authorized to perform this action",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        error: true,
        message: "Invalid product ID.",
      });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        error: true,
        message: "Product not found.",
      });
    }

    const validStatuses = ["pending", "available", "sold out", "archived"];

    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid status provided." });
    }
    await Timestamp.findOneAndUpdate(
      { type: "product" },
      { $set: { updatedAt: Date.now() } },
      {
        new: true,
        upsert: true,
      }
    );
    if (validStatuses.includes(status)) {
      const product = await Product.findByIdAndUpdate(
        productId,
        { status },
        { new: true }
      );

      return res.status(200).json({
        error: false,
        message: "Product status updated successfully.",
        product,
      });
    }
  } catch (err) {
    console.error("Error updating product status:", err);
    res.status(500).json({
      error: true,
      message: "Unable to update product status. Please try again.",
      details: err.message,
    });
  }
});

router.get("/fetch/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Product.findOneAndUpdate(
      { slug: id },
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!product) {
      return res
        .status(404)
        .json({ error: true, message: "product record not found." });
    }
    if (product.status !== "available") {
      return res.status(401).json({
        error: true,
        message: "product currently not available to view",
      });
    }

    res.status(200).json({
      error: false,
      product,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({
      error: true,
      message: "Unable to fetch product. Please try again.",
    });
  }
});

export default router;
