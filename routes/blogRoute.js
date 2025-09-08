import express from "express";
import { Timestamp } from "../models/timestamps.js";
import verifyToken from "../middleware/verifyToken.js";
import { upload, uploadToCloudinary } from "../resources/multer.js";
import { Blog } from "../models/blogs.js";
import slugify from "slugify";
import mongoose from "mongoose";
import axios from "axios";
import { BlogComment } from "../models/blogComment.js";
const router = express.Router();
router.post(
  "/store",
  verifyToken,
  upload.fields([{ name: "thumbnail" }, { name: "images" }]),
  async (req, res) => {
    if (req.user.role === "User") {
      return res.status(403).json({
        error: true,
        message: "Not authorized create blog",
      });
    }
    try {
      const { title, author, excerpt, content } = req.body;
      const thumbnailFile = req.files.thumbnail ? req.files.thumbnail[0] : null;
      const imageFiles = req.files.images || [];

      let thumbnail = null;
      if (thumbnailFile) {
        thumbnail = await uploadToCloudinary(thumbnailFile.buffer);
      }

      const images = await Promise.all(
        imageFiles.map((file) => uploadToCloudinary(file.buffer))
      );

      const slug = slugify(title, { lower: true, strict: true });

      await Blog.create({
        title,
        slug,
        author,
        excerpt,
        content,
        thumbnail,
        images,
      });

      await Timestamp.findOneAndUpdate(
        { type: "blog" },
        { $set: { updatedAt: Date.now() } },
        {
          new: true,
          upsert: true,
        }
      );

      res
        .status(201)
        .json({ error: false, message: "Blog post successfully created" });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: "Error creating blog post", error: error.message });
    }
  }
);
router.get("/fetch/single/:id", async (req, res) => {
  try {
    const blog = await Blog.findOneAndUpdate(
      { slug: req.params.id },
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!blog) {
      return res
        .status(404)
        .json({ error: true, message: "Blog post not found" });
    }
    const comments = await BlogComment.find({ blog: blog._id }).sort({
      createdAt: -1,
    });
    return res.status(200).json({
      error: false,
      message: "Blog details and comments fetched successfully",
      blog,
      comments,
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error retrieving blog post", error: error.message });
  }
});
router.get("/fetch/admin", verifyToken, async (req, res) => {
  if (req.user.role === "User") {
    return res.status(403).json({
      error: true,
      message: "Unauthorized access",
    });
  }
  try {
    const blogs = await Blog.find().sort({
      createdAt: -1,
    });
    res.status(200).json(blogs);
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Failed to fetch blogs.",
    });
  }
});
router.get("/fetch", async (req, res) => {
  try {
    const blogs = await Blog.find({ status: "published" })
      .sort({
        createdAt: -1,
      })
      .limit(6);
    res.status(200).json(blogs);
  } catch (err) {
    res.status(500).json({
      error: true,
      message: "Failed to fetch blogs.",
    });
  }
});
router.put("/status", verifyToken, async (req, res) => {
  try {
    const { blogId, status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid blog ID supplied." });
    }
    const blogExists = await Blog.findById(blogId);
    if (!blogExists) {
      return res.status(404).json({
        error: true,
        message: "The requested blog could not be found.",
      });
    }
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        error: true,
        message: "Not authorized to updated blog status.",
      });
    }
    const blogs = await Blog.findByIdAndUpdate(
      blogId,
      { status: status },
      { new: true }
    ).sort({ createdAt: -1 });
    await Timestamp.findOneAndUpdate(
      { type: "blog" },
      { updatedAt: Date.now() },
      { new: true }
    );
    return res.status(200).json({
      error: false,
      message: "Blog status updated successfully",
      blogs,
      lastUpdated: Date.now(),
    });
  } catch (err) {
    console.error("Error updating blog status:", err);
    res.status(500).json({
      error: true,
      message: "Unable to update review status. Please try again.",
      details: err.message,
    });
  }
});
router.post("/delete", verifyToken, async (req, res) => {
  const { blogId } = req.body;
  try {
    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid blog ID supplied." });
    }
    const blogToDelete = await Blog.findByIdAndDelete(blogId);
    if (!blogToDelete) {
      return res.status(404).json({
        error: true,
        message: "The requested blog could not be found.",
      });
    }
    await Timestamp.findOneAndUpdate(
      { type: "blog" },
      { updatedAt: Date.now() },
      { new: true }
    );
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.status(200).json({
      error: false,
      blogs,
      lastUpdated: Date.now(),
    });
  } catch (error) {
    console.error(`Blog delete error:`, error);
    res.status(500).json({
      message: "Unable to delete blog. Please try again later.",
      error: error.message,
    });
  }
});
router.post("/comment/store", async (req, res) => {
  const { name, email, comment, captchaToken, blogId } = req.body;
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
    const country = data.country ? data.country : "Unknown";
    await BlogComment.create({
      name,
      email,
      comment,
      country,
      blog: blogId,
    });
    await Timestamp.findOneAndUpdate(
      { type: "blog" },
      { $set: { updatedAt: Date.now() } },
      {
        new: true,
        upsert: true,
      }
    );
    return res.status(200).json({
      error: false,
      message: "Your comment has been successfully submitted",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: true,
      message:
        "An error occurred while submitting your comment. Please try again later.",
    });
  }
});

export default router;
