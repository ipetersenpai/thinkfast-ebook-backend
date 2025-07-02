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

// GET Score history for a specific course
router.get("/:courseId/:studentId/:term", async (req, res) => {
  const studentId = parseInt(req.params.studentId);
  const term = req.params.term;
  const courseId = parseInt(req.params.courseId);

  try {
    // 1. Verify the term exists
    const termData = await prisma.academic_Year.findFirst({
      where: { term },
    });

    if (!termData) {
      return res.status(404).json({ error: "Term not found" });
    }

    // 2. Find the enrolled student record
    const enrolledStudent = await prisma.enrolledStudent.findFirst({
      where: {
        student_id: studentId,
        term,
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

    // 3. Check if student is assigned to the specific course
    const isEnrolledInCourse = enrolledStudent.StudentAssignCourses.some(
      (sc) => sc.course_id === courseId
    );

    if (!isEnrolledInCourse) {
      return res
        .status(403)
        .json({ error: "Student is not enrolled in this course" });
    }

    // 4. Fetch course with scores
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
              where: { student_id: enrolledStudent.id }, // Note: use EnrolledStudent.id
            },
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

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

    const fullname = `${enrolledStudent.firstname} ${
      enrolledStudent.middlename ? enrolledStudent.middlename + " " : ""
    }${enrolledStudent.lastname}`;

    res.json({
      fullname,
      year_level: enrolledStudent.year_level,
      course: course.title,
      assessments: [...assessmentScores, ...performanceScores],
    });
  } catch (error) {
    console.error("Error fetching course-specific scores:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET all students' scores in a course for a specific term
router.get("/:courseId/term/:term/scores", async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const term = req.params.term;

  if (isNaN(courseId)) {
    return res.status(400).json({ error: "Invalid course ID" });
  }

  try {
    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        assessments: true,
        performanceTaskScores: true,
      },
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Get all enrolled students assigned to the course in the specified term
    const enrolledStudents = await prisma.enrolledStudent.findMany({
      where: {
        term,
        StudentAssignCourses: {
          some: { course_id: courseId },
        },
      },
      include: {
        StudentAssignCourses: true,
      },
    });

    // Build response
    const studentsWithScores = await Promise.all(
      enrolledStudents.map(async (student) => {
        const fullName = `${student.firstname} ${
          student.middlename ? student.middlename + " " : ""
        }${student.lastname}`;

        // Fetch attempts for all assessments
        const assessmentScores = await Promise.all(
          course.assessments.map(async (a) => {
            const attempt = await prisma.userAttempt.findFirst({
              where: {
                assessment_id: a.id,
                student_id: student.student_id,
              },
              orderBy: {
                submitted_at: "asc",
              },
            });

            return {
              title: a.title,
              score: attempt?.score ?? 0,
              total_points: a.total_points,
            };
          })
        );

        // Fetch scores for performance tasks
        const performanceScores = await Promise.all(
          course.performanceTaskScores.map(async (pt) => {
            const scoreRecord = await prisma.studentPerformanceTask.findFirst({
              where: {
                performance_task_score_id: pt.id,
                student_id: student.id,
              },
            });

            return {
              title: pt.title || "Performance Task",
              score: scoreRecord?.score ?? 0,
              total_points: pt.total_points,
            };
          })
        );

        return {
          student_id: student.student_id,
          fullname: fullName,
          year_level: student.year_level,
          assessments: [...assessmentScores, ...performanceScores],
        };
      })
    );

    res.json(studentsWithScores);
  } catch (error) {
    console.error("Error fetching all student scores:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
