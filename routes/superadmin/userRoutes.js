const express = require("express");
const bcrypt = require("bcrypt");
const prisma = require("../../models/prisma");
const router = express.Router();

// Create user
router.post("/", async (req, res) => {
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

    // Check if username already exists
    const existingUsername = await prisma.user.findFirst({
      where: { username },
    });

    if (existingUsername) {
      return res.status(400).json({ message: "Username already in use" });
    }

    // If email is provided, check if it already exists
    if (email) {
      const existingEmail = await prisma.user.findFirst({
        where: { email },
      });

      if (existingEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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
      },
    });

    res.status(201).json({
      message: "User created",
      user: { ...user, password: undefined },
    });
  } catch (error) {
    console.error(error);

    const errorMessage =
      error instanceof Error ? error.message : "User creation failed";

    res.status(500).json({ message: errorMessage });
  }
});



// Update user
router.put("/update/:id", async (req, res) => {
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

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: id },
    });

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if username is taken by another user
    if (username) {
      const usernameTaken = await prisma.user.findFirst({
        where: {
          username: username,
          NOT: { id: id },
        },
      });

      if (usernameTaken) {
        return res.status(400).json({ message: "Username already in use" });
      }
    }

    // Check if email is taken by another user
    if (email) {
      const emailTaken = await prisma.user.findFirst({
        where: {
          email: email,
          NOT: { id: id },
        },
      });

      if (emailTaken) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }

    // Prepare update data
    const updatedData = {
      firstname,
      lastname,
      middlename,
      username,
      email,
      role,
      status,
    };

    if (password) {
      updatedData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: id },
      data: updatedData,
    });

    res.json({
      message: "User updated successfully",
      user: { ...updatedUser, password: undefined },
    });
  } catch (error) {
    console.error(error);

    const errorMessage =
      error instanceof Error ? error.message : "User update failed";

    res.status(500).json({ message: errorMessage });
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

module.exports = router;
