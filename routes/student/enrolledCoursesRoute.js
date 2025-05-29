// routes/student/enrolledCoursesRoute.js
const express = require("express");
const prisma = require("../../models/prisma");
const router = express.Router();

// GET /api/student/enrolled-courses/:session_id/:student_id
router.get("/enrolled-courses/:student_session_id/:student_id", async (req, res) => {
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
      return res.status(404).json({ status: "error", message: "Student not found" });
    }

    const assignedCourses = enrolledStudent.StudentAssignCourses.map((assign) => assign.course);

    return res.status(200).json({ status: "success", courses: assignedCourses });
  } catch (error) {
    console.error("Error fetching assigned courses:", error);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
});
// GET /api/student/lessons-with-content/:course_id
router.get("/lessons-with-content/:course_id", async (req, res) => {
  const { course_id } = req.params;

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
          },
        },
      },
      orderBy: {
        order_no: "asc",
      },
    });

    // Map assessments to include `assessment_id` instead of `id`
    const lessonsWithFormattedAssessments = lessons.map(lesson => ({
      ...lesson,
      assessments: lesson.assessments.map(a => ({
        assessment_id: a.id,
        title: a.title,
        assessment_type: a.assessment_type,
      })),
    }));

    return res.status(200).json({ status: "success", lessons: lessonsWithFormattedAssessments });
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
      return res.status(404).json({ status: "error", message: "Assessment not found" });
    }

    // Shuffle questions using Fisher-Yates algorithm
    const shuffledQuestions = [...assessment.questions];
    for (let i = shuffledQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledQuestions[i], shuffledQuestions[j]] = [shuffledQuestions[j], shuffledQuestions[i]];
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
  // answers = [{ question_id: 1, selected_option_id: 3 }, ...]

  try {
    const started_at = new Date();

    let score = 0;

    const createdAttempt = await prisma.userAttempt.create({
      data: {
        student_id,
        assessment_id,
        started_at,
      },
    });

    const attemptId = createdAttempt.id;

    for (const answer of answers) {
      const option = await prisma.questionOption.findUnique({
        where: { id: answer.selected_option_id },
      });

      const isCorrect = option?.is_correct || false;

      if (isCorrect) {
        const question = await prisma.question.findUnique({
          where: { id: answer.question_id },
        });
        score += question?.points || 0;
      }

      await prisma.userAnswer.create({
        data: {
          user_attempt_id: attemptId,
          question_id: answer.question_id,
          selected_option_id: answer.selected_option_id,
          is_correct: isCorrect,
        },
      });
    }

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
    return res.status(500).json({ status: "error", message: "Server error" });
  }
});



module.exports = router;
