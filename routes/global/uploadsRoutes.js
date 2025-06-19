const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../../uploads/etc");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "image-" + uniqueSuffix + ext); // Changed to ensure consistent naming
  },
});

// Filter only image files
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

// Initialize multer with no field name restrictions
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
}).any(); // Changed from .single() to .any() to accept any field name

// Upload Route
router.post("/", (req, res) => {
  upload(req, res, async function (err) {
    try {
      if (err) {
        console.error("Upload error:", err);
        return res.status(400).json({
          errorMessage: err.message,
          resultCode: "error"
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          errorMessage: "No file uploaded",
          resultCode: "error"
        });
      }

      // SunEditor sends multiple files, but we'll just use the first one
      const uploadedFile = req.files[0];
      const filePath = `/uploads/etc/${uploadedFile.filename}`;
      const fullUrl = `${req.protocol}://${req.get("host")}${filePath}`;

      res.status(200).json({
        result: [
          {
            url: fullUrl,
            name: uploadedFile.originalname,
          },
        ],
        errorMessage: "",
        resultCode: "success",
      });
    } catch (error) {
      console.error("Server error:", error);
      res.status(500).json({
        errorMessage: "Failed to upload file",
        resultCode: "error"
      });
    }
  });
});

module.exports = router;