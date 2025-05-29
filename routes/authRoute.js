const express = require('express');
const bcrypt = require('bcrypt');
const prisma = require('../models/prisma');
const jwt = require('jsonwebtoken');
const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // ✅ Create JWT token
    const token = jwt.sign(
      {
      id: user.id,
      role: user.role,
      status: user.status,
      },
      process.env.JWT_SECRET, // keep this in your .env file
      { expiresIn: '90d' } // 90 days for approximately 3 months
    );

    // ✅ Send back the token in the response
    res.json({
      message: 'Login successful',
      token, // return the token here
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,

      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
