const express = require('express');
const prisma = require('../../models/prisma');
const router = express.Router();

// Create login log
router.post('/', async (req, res) => {
  const { student_id, mac_address } = req.body;

  if (!student_id || !mac_address) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const existingLog = await prisma.loginLogs.findFirst({
      where: {
        student_id: parseInt(student_id),
        mac_address,
      },
    });

    if (existingLog) {
      return res.status(200).json({
        message: 'Login log already exists',
        log: existingLog,
      });
    }

    const newLog = await prisma.loginLogs.create({
      data: {
        student_id: parseInt(student_id),
        mac_address,
        status: 'pending',
      },
    });

    res.status(201).json(newLog);
  } catch (error) {
    console.error('Error creating login log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check login log approval
router.post('/check', async (req, res) => {
  const { student_id, mac_address } = req.body;

  if (!student_id || !mac_address) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const log = await prisma.loginLogs.findFirst({
      where: {
        student_id: parseInt(student_id),
        mac_address,
        status: 'approved',
      },
    });

    if (log) {
      return res.status(200).json({ status: 'approved' });
    } else {
      return res.status(200).json({ status: 'pending' });
    }
  } catch (error) {
    console.error('Error checking login log:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve login log
router.patch('/approve/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  if (!id) {
    return res.status(400).json({ error: 'Missing login log ID' });
  }

  try {
    const updatedLog = await prisma.loginLogs.update({
      where: { id },
      data: { status: 'approved' },
    });

    res.status(200).json({
      message: 'Login log approved successfully',
      log: updatedLog,
    });
  } catch (error) {
    console.error('Error approving login log:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch all login logs
router.get('/', async (req, res) => {
  try {
    const logs = await prisma.loginLogs.findMany({
      orderBy: {
        created_at: 'desc',
      },
    });

    res.status(200).json(logs);
  } catch (error) {
    console.error('Error fetching login logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete login log
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  if (!id) {
    return res.status(400).json({ error: 'Missing login log ID' });
  }

  try {
    const deletedLog = await prisma.loginLogs.delete({
      where: { id },
    });

    res.status(200).json({
      message: 'Login log deleted successfully',
      log: deletedLog,
    });
  } catch (error) {
    console.error('Error deleting login log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
