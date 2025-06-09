// routes/faculty/performanceTaskRoute.js
const express = require("express");
const prisma = require("../../models/prisma");
const router = express.Router();

// Create a performance task
router.post("/", async (req, res) => {
  const { title, total_points, course_id } = req.body;

  if (!title || !total_points || !course_id) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const newTask = await prisma.performanceTaskScore.create({
      data: {
        title,
        total_points,
        course_id,
      },
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error("Error creating performance task:", error);
    res.status(500).json({ message: "Failed to create performance task." });
  }
});

// Get all performance tasks by course ID
router.get("/course/:courseId", async (req, res) => {
  const { courseId } = req.params;

  try {
    const tasks = await prisma.performanceTaskScore.findMany({
      where: {
        course_id: parseInt(courseId),
      },
      orderBy: {
        created_at: "desc",
      },
    });

    res.json(tasks);
  } catch (error) {
    console.error("Error fetching performance tasks:", error);
    res.status(500).json({ message: "Failed to fetch performance tasks." });
  }
});



// Delete a performance task by ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Optionally, delete related studentPerformanceTask records first if cascade is not enabled
    await prisma.studentPerformanceTask.deleteMany({
      where: {
        performance_task_score_id: parseInt(id),
      },
    });

    const deletedTask = await prisma.performanceTaskScore.delete({
      where: {
        id: parseInt(id),
      },
    });

    res.json({ message: "Performance task deleted successfully.", deletedTask });
  } catch (error) {
    console.error("Error deleting performance task:", error);
    res.status(500).json({ message: "Failed to delete performance task." });
  }
});



// Get all students enrolled in a course with their performance task score for a specific task
router.get("/enrolled-students/:courseId/:pt_id", async (req, res) => {
  const { courseId, pt_id } = req.params;

  try {
    const students = await prisma.studentAssignCourses.findMany({
      where: {
        course_id: parseInt(courseId),
      },
      select: {
        enrolledStudent: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            middlename: true,
            year_level: true,
            studentPerformanceTasks: {
              where: {
                performance_task_score_id: parseInt(pt_id),
              },
              select: {
                id: true,
                performance_task_score_id: true,
                score: true,
                created_at: true,
                updated_at: true,
              },
            },
          },
        },
      },
    });

    // Format to include full name and filtered performance score
    const formatted = students.map(({ enrolledStudent }) => {
      const { id, firstname, middlename, lastname, year_level, studentPerformanceTasks } = enrolledStudent;
      const full_name = [firstname, middlename, lastname].filter(Boolean).join(" ");
      return {
        id,
        full_name,
        year_level,
        performance_score: studentPerformanceTasks[0] || null, // only one expected
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching students with specific performance task score:", error);
    res.status(500).json({ message: "Failed to fetch performance scores." });
  }
});



// Record a student's performance task score
router.post("/score", async (req, res) => {
  const { student_id, performance_task_score_id, score } = req.body;

  if (!student_id || !performance_task_score_id || typeof score !== "number") {
    return res
      .status(400)
      .json({ message: "All fields are required and score must be a number." });
  }

  try {
    // Step 1: Validate total_points
    const performanceTaskScore = await prisma.performanceTaskScore.findUnique({
      where: { id: performance_task_score_id },
    });

    if (!performanceTaskScore) {
      return res.status(404).json({ message: "Performance task not found." });
    }

    if (score > performanceTaskScore.total_points) {
      return res.status(400).json({
        message: `Score cannot exceed total points (${performanceTaskScore.total_points}).`,
      });
    }

    // Step 2: Delete existing score if it exists
    await prisma.studentPerformanceTask.deleteMany({
      where: {
        student_id,
        performance_task_score_id,
      },
    });

    // Step 3: Create new score
    const newScore = await prisma.studentPerformanceTask.create({
      data: {
        student_id,
        performance_task_score_id,
        score,
      },
    });

    res.status(201).json(newScore);
  } catch (error) {
    console.error("Error recording performance task score:", error);
    res.status(500).json({ message: "Failed to record performance task score." });
  }
});




module.exports = router;
