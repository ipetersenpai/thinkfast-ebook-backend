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
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
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

// Initialize multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Upload Route
router.post(
  "/",
  upload.single("uploadFile"), // Must match frontend field name
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ errorMessage: "No file uploaded", resultCode: "error" });
      }

      const filePath = `/uploads/etc/${req.file.filename}`;
      const fullUrl = `${req.protocol}://${req.get("host")}${filePath}`;

      res.status(200).json({
        result: [
          {
            url: fullUrl,
            name: req.file.originalname,
          },
        ],
        errorMessage: "",
        resultCode: "success",
      });
    } catch (error) {
      console.error("Upload error:", error);
      res
        .status(500)
        .json({ errorMessage: "Failed to upload file", resultCode: "error" });
    }
  }
);

module.exports = router;
