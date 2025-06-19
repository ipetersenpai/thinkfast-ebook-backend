// routes/administrative/scoreHistoryRoute.js
const express = require("express");
const router = express.Router();
const prisma = require("../../models/prisma");

// GET /api/score-history/:studentId/:term
router.get("/:studentId/:term", async (req, res) => {
  const studentId = parseInt(req.params.studentId);
  const term = req.params.term;

  try {
    const termData = await prisma.academic_Year.findFirst({
      where: { term },
    });

    if (!termData) {
      return res.status(404).json({ error: "Term not found" });
    }

    const enrolledStudent = await prisma.enrolledStudent.findFirst({
      where: {
        student_id: studentId,
        term: term,
      },
      include: {
        StudentAssignCourses: true,
      },
    });

    if (!enrolledStudent) {
      return res
        .status(404)
        .json({ error: "Student is not enrolled in the specified term" });
    }

    const assignedCourseIds = enrolledStudent.StudentAssignCourses.map(
      (sc) => sc.course_id
    );

    const coursesWithScores = await Promise.all(
      assignedCourseIds.map(async (courseId) => {
        const course = await prisma.course.findUnique({
          where: { id: courseId },
          include: {
            assessments: {
              include: {
                attempts: {
                  where: { student_id: studentId },
                  orderBy: { score: "desc" },
                },
              },
            },
            performanceTaskScores: {
              include: {
                studentPerformanceTasks: {
                  where: { student_id: enrolledStudent.id },
                },
              },
            },
          },
        });

        const assessmentScores = course.assessments.map((a) => {
          const highestAttempt = a.attempts[0];
          return {
            title: a.title,
            score: highestAttempt ? highestAttempt.score : null,
            total_points: a.total_points,
          };
        });

        const performanceScores = course.performanceTaskScores.map((pt) => {
          const scoreRecord = pt.studentPerformanceTasks?.[0];
          return {
            title: pt.title || "Performance Task",
            score: scoreRecord?.score ?? null,
            total_points: pt.total_points,
          };
        });

        return {
          course: course.title,
          assessments: [...assessmentScores, ...performanceScores],
        };
      })
    );

    const fullname = `${enrolledStudent.firstname} ${
      enrolledStudent.middlename ? enrolledStudent.middlename + " " : ""
    }${enrolledStudent.lastname}`;

    res.json({
      fullname,
      year_level: enrolledStudent.year_level,
      courses: coursesWithScores,
    });
  } catch (error) {
    console.error("Error fetching score history:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


module.exports = router;
