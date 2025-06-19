const express = require('express');
const prisma = require('../../models/prisma');
const router = express.Router();

router.post('/', async (req, res) => {
  const { student_id, device_name, ip_address, mac_address } = req.body;

  if (!student_id || !device_name || !ip_address || !mac_address) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const existingLog = await prisma.loginLogs.findFirst({
      where: {
        student_id: parseInt(student_id),
        device_name,
        ip_address,
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
        device_name,
        ip_address,
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

// POST /check
router.post('/check', async (req, res) => {
  const { student_id, device_name, ip_address, mac_address } = req.body;

  if (!student_id || !device_name || !ip_address || !mac_address) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const log = await prisma.loginLogs.findFirst({
      where: {
        student_id: parseInt(student_id),
        device_name,
        ip_address,
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

module.exports = router;
