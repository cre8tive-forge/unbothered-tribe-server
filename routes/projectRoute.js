import express from "express";
import { Projects } from "../models/projects.js";
import { upload, uploadToCloudinary } from "../resources/multer.js";

const router = express.Router();

router.post("/store", upload.array("images"), async (req, res) => {
  const { name, category, date, client, description, type } = req.body;
  try {
    const imageUrls = await Promise.all(
      req.files.map((file) => uploadToCloudinary(file.buffer))
    );
    const saveProject = await Projects.create({
      name,
      category,
      date,
      type,
      client,
      description,
      images: imageUrls,
    });

    return res.status(200).json({
      error: false,
      message: "Project saved successfully",
      project: saveProject,
    });
  } catch (err) {
    console.error("Error saving project:", err);
    res.status(500).json({
      error: true,
      message: "Unable to save your project. Please try again",
      details: err.message,
    });
  }
});
router.get("/get", async (req, res) => {
  try {
    const allproject = await Projects.find().sort({ createdAt: -1 });
    res.json(allproject);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});
router.post(`/find`, async (req, res) => {
  const { projectId } = req.body;

  try {
    const findProject = await Projects.findOne({ _id: projectId });
    if (!findProject) {
      return res.status(401).json({
        error: true,
        message: "Project not found",
      });
    }
    return res.json({ error: false, message: "Project found", findProject });
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch project", error });
  }
});
router.get("/last-updated", async (req, res) => {
  try {
    const latest = await Projects.findOne().sort({ createdAt: -1 });
    res.json({ lastUpdated: latest?.createdAt?.getTime() || Date.now() });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});
router.get("/last-updated/:id", async (req, res) => {
  try {
    const project = await Projects.findById(req.params.id).select("updatedAt");
    res.json({ lastUpdated: project?.updatedAt?.getTime() || Date.now() });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});


export default router;
