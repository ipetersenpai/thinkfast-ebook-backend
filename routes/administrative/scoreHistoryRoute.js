// routes/administrative/scoreHistoryRoute.js
const express = require("express");
const router = express.Router();
const prisma = require("../../models/prisma");

// GET /api/score-history/:studentId/:term
router.get("/:studentId/:term", async (req, res) => {
  const studentId = parseInt(req.params.studentId);
  const term = req.params.term;

  try {
    // 1. Verify the term exists
    const termData = await prisma.academic_Year.findFirst({
      where: { term },
    });

    if (!termData) {
      return res.status(404).json({ error: "Term not found" });
    }

    // 2. Find enrolled student record for this student_id in the term
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

    // 3. For each course, fetch assessment and performance task scores
    const coursesWithScores = await Promise.all(
      assignedCourseIds.map(async (courseId) => {
        const course = await prisma.course.findUnique({
          where: { id: courseId },
          include: {
            assessments: {
              include: {
                attempts: {
                  where: { student_id: studentId },
                },
              },
            },
            performanceTaskScores: {
              include: {
                studentPerformanceTasks: {
                  where: { student_id: enrolledStudent.id }, // uses EnrolledStudent.id
                },
              },
            },
          },
        });

        const assessmentScores = course.assessments.map((a) => {
          const attempt = a.attempts[0]; // first attempt
          return {
            title: a.title,
            score: attempt?.score ?? 0,
            total_points: a.total_points,
          };
        });

        const performanceScores = course.performanceTaskScores.map((pt) => {
          const scoreRecord = pt.studentPerformanceTasks?.[0];
          return {
            title: pt.title || "Performance Task",
            score: scoreRecord?.score ?? 0,
            total_points: pt.total_points,
          };
        });

        return {
          course: course.title,
          assessments: [...assessmentScores, ...performanceScores],
        };
      })
    );

    // 4. Include student fullname and year_level
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
