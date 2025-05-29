const prisma = require("../../models/prisma");
const express = require("express");
const router = express.Router();

// 📌 Create a new academic year
router.post("/", async (req, res) => {
  const { term, description, status, start_date, end_date } = req.body;

  try {
    const existingYear = await prisma.academic_Year.findFirst({
      where: { term },
    });

    if (existingYear) {
      return res.status(400).json({ message: "Academic year already exists" });
    }

    if (status === "active") {
      await prisma.academic_Year.updateMany({
        where: { status: "active" },
        data: { status: "inactive" },
      });
    }

    const newYear = await prisma.academic_Year.create({
      data: { term, description, status, start_date: new Date(start_date), end_date: new Date(end_date) },
    });

    res.status(201).json(newYear);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 📌 Get all academic years
router.get("/", async (req, res) => {
  try {
    const years = await prisma.academic_Year.findMany({
      orderBy: { created_at: 'desc' },
    });
    res.json(years);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 📌 Get academic year by ID
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const year = await prisma.academic_Year.findUnique({ where: { id } });

    if (!year) {
      return res.status(404).json({ message: "Academic year not found" });
    }

    res.json(year);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 📌 Update academic year by ID
router.put("/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { term, description, status, start_date, end_date } = req.body;

    if (!term || !description || !status || !start_date || !end_date) {
        return res.status(400).json({ message: "All fields are required." });
    }

    try {
        if (status.toLowerCase() === "active") {
            // Deactivate all other academic years
            await prisma.academic_Year.updateMany({
                where: {
                    status: "active",
                    NOT: { id },
                },
                data: { status: "inactive" },
            });
        }

        const updatedAcademicYear = await prisma.academic_Year.update({
            where: { id },
            data: {
                term,
                description,
                status,
                start_date: new Date(start_date),
                end_date: new Date(end_date),
            },
        });

        res.status(200).json(updatedAcademicYear);
    } catch (error) {
        console.error(error);
        if (error.code === "P2025") {
            return res.status(404).json({ message: "Academic year not found" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
});


// 📌 Delete academic year by ID
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    await prisma.academic_Year.delete({ where: { id } });
    res.json({ message: "Academic year deleted successfully" });
  } catch (error) {
    console.error(error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: "Academic year not found" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
