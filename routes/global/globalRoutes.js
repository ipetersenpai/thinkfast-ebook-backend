const express = require('express');
const prisma = require('../../models/prisma');
const router = express.Router();

// Get a single user by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id, 10) },
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

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
