const express = require('express');
const bcrypt = require('bcrypt');
const prisma = require('../../models/prisma');


const router = express.Router();

// Create user
router.post('/', async (req, res) => {
  try {
    const { firstname, lastname, middlename, username, password, email, role, status } = req.body;

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

    res.status(201).json({ message: 'User created', user: { ...user, password: undefined } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'User creation failed' });
  }
});

// Get all users
router.get('/', async (req, res) => {
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
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
