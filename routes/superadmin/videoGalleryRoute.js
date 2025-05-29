const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const prisma = require("../../models/prisma");

const router = express.Router();

const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../../uploads/videos");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "video-" + uniqueSuffix + ext);
  },
});

const uploadVideo = multer({ storage: videoStorage });

// GET all videos
router.get("/", async (req, res) => {
  try {
    const videos = await prisma.videoGallery.findMany({
      orderBy: { created_at: "desc" },
    });
    res.json(videos);  // returns an array of video metadata objects
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

// POST upload a new video
router.post("/", uploadVideo.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded." });
    }

    const videoPath = `/uploads/videos/${req.file.filename}`;

    const newVideo = await prisma.videoGallery.create({
      data: {
        video_url: videoPath,
      },
    });

    res.status(201).json(newVideo);
  } catch (error) {
    console.error("Error uploading video:", error);
    res.status(500).json({ error: "Failed to upload video" });
  }
});

// DELETE video by ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const video = await prisma.videoGallery.findUnique({
      where: { id: parseInt(id) },
    });

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const videoFilePath = path.join(__dirname, `../../${video.video_url}`);
    if (fs.existsSync(videoFilePath)) {
      fs.unlinkSync(videoFilePath);
    }

    await prisma.videoGallery.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: "Video deleted successfully." });
  } catch (error) {
    console.error("Error deleting video:", error);
    res.status(500).json({ error: "Failed to delete video" });
  }
});

// DELETE all videos
router.delete("/", async (req, res) => {
  try {
    const videos = await prisma.videoGallery.findMany();

    // Delete video files from filesystem
    for (const video of videos) {
      const videoFilePath = path.join(__dirname, `../../${video.video_url}`);
      if (fs.existsSync(videoFilePath)) {
        fs.unlinkSync(videoFilePath);
      }
    }

    // Delete all entries from DB
    await prisma.videoGallery.deleteMany();

    res.json({ message: "All videos deleted successfully." });
  } catch (error) {
    console.error("Error deleting all videos:", error);
    res.status(500).json({ error: "Failed to delete all videos" });
  }
});

module.exports = router;
