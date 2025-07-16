// routes\superadmin\userRoute.js
const express = require("express");
const bcrypt = require("bcrypt");
const prisma = require("../../models/prisma");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../../uploads/user_profiles");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "profile-" + uniqueSuffix + ext);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
}).any();


// CREATE USER
router.post("/", upload, async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      middlename,
      username,
      password,
      email,
      role,
      status,
    } = req.body;

    const existingUsername = await prisma.user.findFirst({ where: { username } });
    if (existingUsername) {
      return res.status(400).json({ message: "Username already in use" });
    }

    if (email) {
      const existingEmail = await prisma.user.findFirst({ where: { email } });
      if (existingEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    const uploadedFile = req.files?.[0];
    const profilePath = uploadedFile
      ? `/uploads/user_profiles/${uploadedFile.filename}`
      : null;

    const user = await prisma.user.create({
      data: {
        firstname,
        lastname,
        middlename,
        username,
        password: hashedPassword,
        email,
        role,
        status,
        profile_display: profilePath,
      },
    });

    res.status(201).json({
      message: "User created",
      user: { ...user, password: undefined },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "User creation failed" });
  }
});


// UPDATE USER
router.put("/update/:id", upload, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      firstname,
      lastname,
      middlename,
      username,
      password,
      email,
      role,
      status,
    } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (username) {
      const usernameTaken = await prisma.user.findFirst({
        where: { username, NOT: { id } },
      });
      if (usernameTaken) {
        return res.status(400).json({ message: "Username already in use" });
      }
    }

    if (email) {
      const emailTaken = await prisma.user.findFirst({
        where: { email, NOT: { id } },
      });
      if (emailTaken) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }

    const updatedData = {
      firstname,
      lastname,
      middlename,
      username,
      email,
      role,
      status,
    };

    const trimmedPassword = typeof password === "string" ? password.trim() : "";
    if (trimmedPassword.length > 0) {
      updatedData.password = await bcrypt.hash(trimmedPassword, 10);
    }

    // Handle profile image replacement
    const uploadedFile = req.files?.[0];
    if (uploadedFile) {
      if (existingUser.profile_display) {
        const oldPath = path.join(__dirname, "../../", existingUser.profile_display);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      updatedData.profile_display = `/uploads/user_profiles/${uploadedFile.filename}`;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updatedData,
    });

    res.json({
      message: "User updated successfully",
      user: { ...updatedUser, password: undefined },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "User update failed" });
  }
});


// Get all users
router.get("/", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstname: true,
        lastname: true,
        middlename: true,
        username: true,
        email: true,
        role: true,
        status: true,
        profile_display: true,
        created_at: true,
        updated_at: true,
      },
    });

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});


// Deactivate user
router.patch("/deactivate/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status: "inactive" },
    });

    res.json({
      message: "User deactivated successfully",
      user: { ...updatedUser, password: undefined },
    });
  } catch (error) {
    console.error(error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to deactivate user";
    res.status(500).json({ message: errorMessage });
  }
});

module.exports = router;
