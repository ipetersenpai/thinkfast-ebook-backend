const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const prisma = require("../../models/prisma");

const router = express.Router();

// Dynamic storage based on field name
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let subfolder = "";
    if (file.fieldname === "cover_image") {
      subfolder = "covers";
    } else if (file.fieldname === "content_html") {
      subfolder = "html";
    }

    const uploadPath = path.join(__dirname, `../../uploads/ebooks/${subfolder}`);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({ storage });

// POST route to upload ebook
router.post(
  "/",
  upload.fields([
    { name: "cover_image", maxCount: 1 },
    { name: "content_html", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { title, description } = req.body;

      if (!req.files || !req.files.content_html) {
        return res.status(400).json({ error: "Content HTML file is required." });
      }

      const coverImagePath = req.files.cover_image
        ? `/uploads/ebooks/covers/${req.files.cover_image[0].filename}`
        : null;

      const contentHtmlPath = `/uploads/ebooks/html/${req.files.content_html[0].filename}`;

      const newEbook = await prisma.ebooks.create({
        data: {
          title,
          description,
          cover_image: coverImagePath,
          content_html: contentHtmlPath,
        },
      });

      res.status(201).json(newEbook);
    } catch (error) {
      console.error("Error creating ebook:", error);
      res.status(500).json({ error: "Failed to create ebook" });
    }
  }
);

// GET all ebooks
router.get("/", async (req, res) => {
  try {
    const ebooks = await prisma.ebooks.findMany({
      orderBy: { created_at: "desc" },
    });
    res.json(ebooks);
  } catch (error) {
    console.error("Error fetching ebooks:", error);
    res.status(500).json({ error: "Failed to fetch ebooks" });
  }
});

// GET ebook by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const ebook = await prisma.ebooks.findUnique({
      where: { id: parseInt(id) },
    });

    if (!ebook) {
      return res.status(404).json({ error: "Ebook not found" });
    }

    res.json(ebook);
  } catch (error) {
    console.error("Error fetching ebook:", error);
    res.status(500).json({ error: "Failed to fetch ebook" });
  }
});


// PUT route to update ebook
router.put(
  "/:id",
  upload.fields([
    { name: "cover_image", maxCount: 1 },
    { name: "content_html", maxCount: 1 },
  ]),
  async (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;

    try {
      const ebook = await prisma.ebooks.findUnique({
        where: { id: parseInt(id) },
      });

      if (!ebook) {
        return res.status(404).json({ error: "Ebook not found" });
      }

      const updateData = {
        title: title || ebook.title,
        description: description || ebook.description,
        cover_image: ebook.cover_image,
        content_html: ebook.content_html,
      };

      // Replace cover image if new one uploaded
      if (req.files.cover_image) {
        const newCoverPath = `/uploads/ebooks/covers/${req.files.cover_image[0].filename}`;
        const oldCoverPath = path.join(__dirname, `../../${ebook.cover_image}`);

        if (fs.existsSync(oldCoverPath)) {
          fs.unlinkSync(oldCoverPath); // delete old cover
        }

        updateData.cover_image = newCoverPath;
      } else if (req.body.cover_image === null || req.body.cover_image === "null") {
        // Explicitly remove cover image if requested
        const oldCoverPath = path.join(__dirname, `../../${ebook.cover_image}`);
        if (fs.existsSync(oldCoverPath)) {
          fs.unlinkSync(oldCoverPath); // delete old cover
        }
        updateData.cover_image = null;
      }

      // Replace HTML content if new one uploaded
      if (req.files.content_html) {
        const newHtmlPath = `/uploads/ebooks/html/${req.files.content_html[0].filename}`;
        const oldHtmlPath = path.join(__dirname, `../../${ebook.content_html}`);

        if (fs.existsSync(oldHtmlPath)) {
          fs.unlinkSync(oldHtmlPath); // delete old html
        }

        updateData.content_html = newHtmlPath;
      }

      const updatedEbook = await prisma.ebooks.update({
        where: { id: parseInt(id) },
        data: updateData,
      });

      res.json(updatedEbook);
    } catch (error) {
      console.error("Error updating ebook:", error);
      res.status(500).json({ error: "Failed to update ebook" });
    }
  }
);



// DELETE route to remove ebook and files
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const ebook = await prisma.ebooks.findUnique({
      where: { id: parseInt(id) },
    });

    if (!ebook) {
      return res.status(404).json({ error: "Ebook not found" });
    }

    // Remove cover image
    const coverImagePath = path.join(__dirname, `../../${ebook.cover_image}`);
    if (fs.existsSync(coverImagePath)) {
      fs.unlinkSync(coverImagePath);
    }

    // Remove content HTML
    const contentHtmlPath = path.join(__dirname, `../../${ebook.content_html}`);
    if (fs.existsSync(contentHtmlPath)) {
      fs.unlinkSync(contentHtmlPath);
    }

    // Delete from database
    await prisma.ebooks.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: "Ebook deleted successfully." });
  } catch (error) {
    console.error("Error deleting ebook:", error);
    res.status(500).json({ error: "Failed to delete ebook" });
  }
});

module.exports = router;
