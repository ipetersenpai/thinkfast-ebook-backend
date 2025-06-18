const express = require('express');
const prisma = require('../../models/prisma');
const router = express.Router();

router.post('/', async (req, res) => {
  const { student_id, device_name, ip_address, mac_address } = req.body;

  if (!student_id || !device_name || !ip_address || !mac_address) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check if the device is already approved
    const approvedDevice = await prisma.approveDevice.findFirst({
      where: {
        student_id,
        device_name,
        ip_address,
        mac_address,
      },
    });

    // Determine status
    const status = approvedDevice ? 'approved' : 'pending';

    // Store login attempt with status
    await prisma.loginLogs.create({
      data: {
        student_id,
        device_name,
        ip_address,
        mac_address,
        status,
      },
    });

    return res.json({ status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = router;