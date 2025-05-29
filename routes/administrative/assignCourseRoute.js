// routes/administrative/assignCourseRoute.jsx
const express = require("express");
const prisma = require("../../models/prisma");
const router = express.Router();


// Get all assigned courses for a specific enrolled student
router.get("/enrolled/:id", async (req, res) => {
    const enrolledStudentId = parseInt(req.params.id, 10);

    try {
      const assignedCourses = await prisma.studentAssignCourses.findMany({
        where: {
          enrolled_student_id: enrolledStudentId,
        },
        include: {
          course: true,
        },
        orderBy: {
          created_at: "desc",
        },
      });

      res.status(200).json(assignedCourses);
    } catch (error) {
      console.error("Error fetching assigned courses:", error);
      res.status(500).json({ message: "Failed to retrieve assigned courses." });
    }
  });



// Create multiple assigned courses for multiple students
router.post("/", async (req, res) => {
  const assignments = req.body;

  try {
    const dataToCreate = assignments.map((entry) => ({
      term: entry.term,
      enrolled_student_id: parseInt(entry.enrolled_student_id, 10),
      course_id: parseInt(entry.course_id, 10),
    }));

    const result = await prisma.studentAssignCourses.createMany({
      data: dataToCreate,
      skipDuplicates: true, // optional
    });

    res.status(201).json({
      message: "Courses assigned to students successfully",
      count: result.count,
    });
  } catch (error) {
    console.error("Error assigning courses to multiple students:", error);
    res.status(500).json({ message: "Failed to assign courses." });
  }
});

// Update a single assigned course by ID
router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { term, enrolled_student_id, course_id } = req.body;

  try {
    const updatedAssignment = await prisma.studentAssignCourses.update({
      where: { id },
      data: {
        term,
        enrolled_student_id: parseInt(enrolled_student_id, 10),
        course_id: parseInt(course_id, 10),
      },
    });

    res.status(200).json(updatedAssignment);
  } catch (error) {
    console.error("Error updating assigned course:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Assigned course not found" });
    }
    res.status(500).json({ message: "Failed to update assigned course." });
  }
});

// Delete a single assigned course by ID
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    await prisma.studentAssignCourses.delete({
      where: { id },
    });

    res.status(200).json({ message: "Assigned course deleted successfully" });
  } catch (error) {
    console.error("Error deleting assigned course:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Assigned course not found" });
    }
    res.status(500).json({ message: "Failed to delete assigned course." });
  }
});

// GET Courses (optionally filter by term and exclude already assigned to student)
router.get("/", async (req, res) => {
  const { term, student_id } = req.query;

  try {
    const courses = await prisma.course.findMany({
      where: {
        ...(term && { term }),
        ...(student_id && {
          StudentAssignCourses: {
            none: {
              enrolled_student_id: parseInt(student_id, 10),
            },
          },
        }),
      },
      orderBy: { created_at: "desc" },
    });

    res.status(200).json(courses);
  } catch (error) {
    console.error("Error fetching filtered courses:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


module.exports = router;
