// routes/student/enrolledCoursesRoute.js
const express = require("express");
const prisma = require("../../models/prisma");
const router = express.Router();

// GET /api/student/enrolled-courses/:session_id/:student_id
router.get(
  "/enrolled-courses/:student_session_id/:student_id",
  async (req, res) => {
    const { student_session_id, student_id } = req.params;

    try {
      const enrolledStudent = await prisma.enrolledStudent.findFirst({
        where: {
          student_session_id: Number(student_session_id),
          student_id: Number(student_id),
        },
        include: {
          StudentAssignCourses: {
            include: {
              course: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  faculty_id: true,
                  faculty_full_name: true,
                },
              },
            },
          },
        },
      });

      if (!enrolledStudent) {
        return res
          .status(404)
          .json({ status: "error", message: "Student not found" });
      }

      const assignedCourses = enrolledStudent.StudentAssignCourses.map(
        (assign) => assign.course
      );

      return res
        .status(200)
        .json({ status: "success", courses: assignedCourses });
    } catch (error) {
      console.error("Error fetching assigned courses:", error);
      return res.status(500).json({ status: "error", message: "Server error" });
    }
  }
);
// GET /api/student/lessons-with-content/:course_id
router.get("/lessons-with-content/:course_id", async (req, res) => {
  const { course_id } = req.params;
  const { student_id } = req.query; // Get student_id from query params

  try {
    const lessons = await prisma.lesson.findMany({
      where: {
        course_id: Number(course_id),
      },
      include: {
        content: true,
        assessments: {
          select: {
            id: true,
            title: true,
            assessment_type: true,
            time_limit: true,
            attempt_limit: true,
            date_open: true,
            date_close: true,
            total_points: true, // Added total_points to calculate score ratio
            _count: {
              select: { questions: true },
            },
            attempts: {
              where: {
                student_id: student_id ? Number(student_id) : undefined,
              },
              select: {
                score: true,
                submitted_at: true,
              },
              orderBy: {
                score: "desc", // Order by score to easily get highest score
              },
            },
          },
        },
      },
      orderBy: {
        order_no: "asc",
      },
    });

    // Map assessments to include student performance data
    const lessonsWithFormattedAssessments = lessons.map((lesson) => ({
      ...lesson,
      assessments: lesson.assessments.map((a) => {
        const attempts = a.attempts;
        const highestScore = attempts.length > 0 ? attempts[0].score : null;
        const attemptCount = attempts.length;

        return {
          assessment_id: a.id,
          title: a.title,
          assessment_type: a.assessment_type,
          time_limit: a.time_limit,
          attempt_limit: a.attempt_limit,
          date_open: a.date_open,
          date_close: a.date_close,
          total_questions: a._count.questions,
          total_points: a.total_points,
          student_performance: student_id
            ? {
                highest_score: highestScore,
                score_display:
                  highestScore !== null
                    ? `${highestScore}/${a.total_points}`
                    : null,
                attempt_count: attemptCount,
                attempt_display: `${attemptCount}/${a.attempt_limit}`,
              }
            : null,
        };
      }),
    }));

    return res.status(200).json({
      status: "success",
      lessons: lessonsWithFormattedAssessments,
      student_id: student_id ? Number(student_id) : null,
    });
  } catch (error) {
    console.error("Error fetching lessons and content:", error);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
});

// GET /api/student/assessment/:assessment_id/questions
router.get("/assessment/:assessment_id/questions", async (req, res) => {
  const { assessment_id } = req.params;

  try {
    // Fetch assessment info along with its questions and options
    const assessment = await prisma.assessment.findUnique({
      where: {
        id: Number(assessment_id),
      },
      select: {
        title: true,
        description: true,
        total_points: true,
        time_limit: true,
        assessment_type: true,
        questions: {
          select: {
            id: true,
            question: true,
            type: true,
            points: true,
            options: {
              select: {
                id: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!assessment) {
      return res
        .status(404)
        .json({ status: "error", message: "Assessment not found" });
    }

    // Shuffle questions using Fisher-Yates algorithm
    const shuffledQuestions = [...assessment.questions];
    for (let i = shuffledQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledQuestions[i], shuffledQuestions[j]] = [
        shuffledQuestions[j],
        shuffledQuestions[i],
      ];
    }

    return res.status(200).json({
      status: "success",
      assessment: {
        title: assessment.title,
        description: assessment.description,
        total_points: assessment.total_points,
        time_limit: assessment.time_limit,
        assessment_type: assessment.assessment_type,
        questions: shuffledQuestions,
      },
    });
  } catch (error) {
    console.error("Error fetching questions and assessment:", error);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
});

// POST /api/student/submit-attempt
router.post("/submit-attempt", async (req, res) => {
  const { student_id, assessment_id, answers } = req.body;

  try {
    const started_at = new Date();
    let score = 0;

    // Create the user attempt
    const createdAttempt = await prisma.userAttempt.create({
      data: {
        student_id,
        assessment_id,
        started_at,
        score: 0,
      },
    });

    const attemptId = createdAttempt.id;

    // Process each answer
    for (const answer of answers) {
      let isCorrect = false;
      let selectedOptionId = null;

      const question = await prisma.question.findUnique({
        where: { id: answer.question_id },
      });

      if (!question) continue;

      // Case 1: Multiple choice or true/false
      if (answer.selected_option_id) {
        const option = await prisma.questionOption.findUnique({
          where: { id: answer.selected_option_id },
        });

        isCorrect = option?.is_correct || false;
        selectedOptionId = answer.selected_option_id;
      }

      // Case 2: identifcation input
      else if (answer.input_answer) {
        const input = answer.input_answer.trim().toLowerCase();

        // Fetch all correct options for the question
        const correctOptions = await prisma.questionOption.findMany({
          where: {
            question_id: answer.question_id,
            is_correct: true,
            description: {
              not: null,
            },
          },
        });

        // Check for exact match (case-insensitive)
        const match = correctOptions.find(
          (opt) => opt.description?.trim().toLowerCase() === input
        );

        if (match) {
          isCorrect = true;
          selectedOptionId = match.id;
        }
      }

      // Award points if correct
      if (isCorrect) {
        score += question.points || 0;
      }

      // Save the user's answer
      await prisma.userAnswer.create({
        data: {
          user_attempt_id: attemptId,
          question_id: answer.question_id,
          selected_option_id: selectedOptionId,
          is_correct: isCorrect,
          input_answer: answer.input_answer || null,
        },
      });
    }

    // Update the user attempt with final score and submission time
    await prisma.userAttempt.update({
      where: { id: attemptId },
      data: {
        submitted_at: new Date(),
        score,
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Attempt submitted",
      score,
    });
  } catch (error) {
    console.error("Error submitting attempt:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
});

// GET /api/academic-year
router.get("/academic-year", async (req, res) => {
  try {
    const years = await prisma.academic_Year.findMany({
      orderBy: { created_at: "desc" },
    });
    res.json(years);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/student/score-history/:studentId/:term
router.get("/score-history/:studentId/:term", async (req, res) => {
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
                  orderBy: { score: 'desc' }, // Order attempts by score descending
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
          const highestAttempt = a.attempts[0]; // Get the highest score attempt
          return {
            title: a.title,
            score: highestAttempt ? highestAttempt.score : null, // Return null if no attempts
            total_points: a.total_points,
          };
        });

        const performanceScores = course.performanceTaskScores.map((pt) => {
          const scoreRecord = pt.studentPerformanceTasks?.[0];
          return {
            title: pt.title || "Performance Task",
            score: scoreRecord?.score ?? null, // Return null if no score
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
