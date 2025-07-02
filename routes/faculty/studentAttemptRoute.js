// routes/faculty/studentAttemptRoute.js
const express = require("express");
const prisma = require("../../models/prisma");
const router = express.Router();

// GET /api/student-attempts/:studentId/:assessmentId
// router.get("/:studentId/:assessmentId", async (req, res) => {
//   const studentId = parseInt(req.params.studentId);
//   const assessmentId = parseInt(req.params.assessmentId);

//   if (isNaN(studentId) || isNaN(assessmentId)) {
//     return res.status(400).json({ error: "Invalid student ID or assessment ID." });
//   }

//   try {
//     const bestAttempt = await prisma.userAttempt.findFirst({
//       where: {
//         student_id: studentId,
//         assessment_id: assessmentId,
//       },
//       orderBy: {
//         score: 'desc',
//       },
//       include: {
//         assessment: {
//           select: {
//             id: true,
//             title: true,
//             assessment_type: true,
//             course_id: true,
//             lesson_id: true,
//             total_points: true,
//             date_open: true,
//             date_close: true,
//           },
//         },
//         userAnswers: {
//           include: {
//             question: {
//               select: {
//                 id: true,
//                 question: true,
//                 points: true,
//                 type: true,
//               },
//             },
//             selectedOption: {
//               select: {
//                 id: true,
//                 description: true,
//                 is_correct: true,
//               },
//             },
//           },
//         },
//       },
//     });

//     if (!bestAttempt) {
//       return res.status(404).json({ error: "No attempts found for this student and assessment." });
//     }

//     // Optional enhancement: format userAnswers to show input_answer if no selected option
//     const formattedAnswers = bestAttempt.userAnswers.map((answer) => {
//       return {
//         question: answer.question,
//         selectedOption: answer.selectedOption,
//         input_answer: answer.input_answer,
//         is_correct: answer.is_correct,
//       };
//     });

//     res.json({
//       ...bestAttempt,
//       userAnswers: formattedAnswers,
//     });
//   } catch (error) {
//     console.error("Failed to fetch student best attempt:", error);
//     res.status(500).json({ error: "Internal server error." });
//   }
// });

router.get("/:studentId/:assessmentId", async (req, res) => {
  const studentId = parseInt(req.params.studentId);
  const assessmentId = parseInt(req.params.assessmentId);

  if (isNaN(studentId) || isNaN(assessmentId)) {
    return res
      .status(400)
      .json({ error: "Invalid student ID or assessment ID." });
  }

  try {
    const bestAttempt = await prisma.userAttempt.findFirst({
      where: {
        student_id: studentId,
        assessment_id: assessmentId,
      },
      orderBy: {
        score: "desc",
      },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            assessment_type: true,
            course_id: true,
            lesson_id: true,
            total_points: true,
            date_open: true,
            date_close: true,
          },
        },
        userAnswers: {
          include: {
            question: {
              select: {
                id: true,
                question: true,
                points: true,
                type: true,
              },
            },
            selectedOption: {
              select: {
                id: true,
                description: true,
                is_correct: true,
              },
            },
          },
        },
      },
    });

    if (!bestAttempt) {
      return res.status(200).json({
        message: "No student attempt yet.",
        userAnswers: [],
      });
    }

    // Format userAnswers
    const formattedAnswers = bestAttempt.userAnswers.map((answer) => {
      const { type, points } = answer.question;

      return {
        question: answer.question,
        selectedOption: answer.selectedOption,
        input_answer: answer.input_answer,
        is_correct: type === "essay" ? "Not Applicable" : answer.is_correct,
        display_score:
          type === "essay"
            ? `${points}`
            : `${answer.is_correct ? points : 0} / ${points}`,
      };
    });

    res.json({
      ...bestAttempt,
      userAnswers: formattedAnswers,
    });
  } catch (error) {
    console.error("Failed to fetch student best attempt:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// get all students assigned to a course
router.get("/course/:courseId/students", async (req, res) => {
  const courseId = parseInt(req.params.courseId);

  if (isNaN(courseId)) {
    return res.status(400).json({ error: "Invalid course ID." });
  }

  try {
    const assignedStudents = await prisma.studentAssignCourses.findMany({
      where: {
        course_id: courseId,
      },
      include: {
        enrolledStudent: {
          select: {
            id: true,
            student_id: true,
            firstname: true,
            lastname: true,
            middlename: true,
            year_level: true,
            term: true,
          },
        },
      },
    });

    const students = assignedStudents.map((a) => {
      const { firstname, middlename, lastname, ...rest } = a.enrolledStudent;
      const full_name = [firstname, middlename, lastname]
        .filter(Boolean)
        .join(" ");
      return { ...rest, full_name };
    });

    res.json(students);
  } catch (error) {
    console.error("Failed to fetch students for course:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET all students assigned to a course and their attempt count for a specific assessment
router.get("/course/:courseId/students/:assessmentId", async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const assessmentId = parseInt(req.params.assessmentId);

  if (isNaN(courseId) || isNaN(assessmentId)) {
    return res
      .status(400)
      .json({ error: "Invalid course ID or assessment ID." });
  }

  try {
    // Get the assessment attempt limit
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { attempt_limit: true },
    });

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found." });
    }

    // Get all students assigned to the course
    const assignedStudents = await prisma.studentAssignCourses.findMany({
      where: {
        course_id: courseId,
      },
      include: {
        enrolledStudent: {
          select: {
            id: true,
            student_id: true,
            firstname: true,
            lastname: true,
            middlename: true,
            year_level: true,
            term: true,
          },
        },
      },
    });

    // For each student, count how many attempts they made for the given assessment
    const studentsWithAttempts = await Promise.all(
      assignedStudents.map(async (a) => {
        const student = a.enrolledStudent;

        const full_name = [
          student.firstname,
          student.middlename,
          student.lastname,
        ]
          .filter(Boolean)
          .join(" ");

        const attemptCount = await prisma.userAttempt.count({
          where: {
            student_id: student.student_id,
            assessment_id: assessmentId,
          },
        });

        return {
          id: student.id,
          student_id: student.student_id,
          full_name,
          year_level: student.year_level,
          term: student.term,
          attemptCount, // for sorting
          attempts: `${attemptCount} out of ${assessment.attempt_limit}`,
        };
      })
    );

    // Sort students by attempt count in descending order
    studentsWithAttempts.sort((a, b) => b.attemptCount - a.attemptCount);

    // Optionally remove attemptCount before sending response
    const result = studentsWithAttempts.map(({ attemptCount, ...rest }) => rest);

    res.json(result);
  } catch (error) {
    console.error("Failed to fetch students with attempts:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET /assessments/:courseId
router.get("/assessments/course/:courseId", async (req, res) => {
  const courseId = parseInt(req.params.courseId);

  if (isNaN(courseId)) {
    return res.status(400).json({ error: "Invalid course ID." });
  }

  try {
    const assessments = await prisma.assessment.findMany({
      where: { course_id: courseId },
      select: {
        id: true,
        title: true,
        assessment_type: true,
        total_points: true,
        attempt_limit: true,
        time_limit: true,
        date_open: true,
        date_close: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    res.json(assessments);
  } catch (error) {
    console.error("Failed to fetch assessments for course:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


// PATCH /api/student-attempts/:attemptId/update-score
router.patch("/:attemptId/update-score", async (req, res) => {
  const attemptId = parseInt(req.params.attemptId);
  const { score } = req.body;

  if (isNaN(attemptId) || typeof score !== "number") {
    return res.status(400).json({ error: "Invalid attempt ID or score." });
  }

  try {
    // Fetch the current attempt with its related assessment
    const attempt = await prisma.userAttempt.findUnique({
      where: { id: attemptId },
      include: {
        assessment: {
          select: { total_points: true },
        },
      },
    });

    if (!attempt) {
      return res.status(404).json({ error: "User attempt not found." });
    }

    if (score > attempt.assessment.total_points) {
      return res.status(400).json({
        error: `Score cannot exceed total points (${attempt.assessment.total_points}).`,
      });
    }

    // Update the score
    const updatedAttempt = await prisma.userAttempt.update({
      where: { id: attemptId },
      data: { score },
    });

    res.json({
      message: "Score updated successfully.",
      attempt: updatedAttempt,
    });
  } catch (error) {
    console.error("Error updating score:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


module.exports = router;
