import express from "express";
import { Timestamp } from "../models/timestamps.js";
import verifyToken from "../middleware/verifyToken.js";
import { upload, uploadToCloudinary } from "../resources/multer.js";
import { Blog } from "../models/blogs.js";
import slugify from "slugify";
import mongoose from "mongoose";
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
    console.log(req.params.id);
    const blog = await Blog.findOne({ slug: req.params.id });
    if (!blog) {
      return res
        .status(404)
        .json({ error: true, message: "Blog post not found" });
    }
    res.status(200).json(blog);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error retrieving blog post", error: error.message });
  }
});
router.get("/fetch/dashboard", verifyToken, async (req, res) => {
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

export default router;
