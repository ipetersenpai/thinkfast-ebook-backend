// routes/administrative/assessmentRoute.js
const express = require("express");
const prisma = require("../../models/prisma");
const router = express.Router();

// Create new assessment /api/assessment
router.post("/", async (req, res) => {
  try {
    const {
      title,
      description,
      assessment_type,
      total_points,
      time_limit,
      attempt_limit,
      course_id,
      lesson_id,
      questions,
      date_open,
      date_close,
    } = req.body;

    // Validate required fields
    if (!title || !assessment_type || !course_id || !lesson_id) {
      return res.status(400).json({
        error: "Title, assessment type, course ID, and lesson ID are required",
      });
    }

    // Validate questions
    if (!questions || questions.length === 0) {
      return res.status(400).json({
        error: "At least one question is required",
      });
    }

    // Calculate total points from questions if not provided
    const calculatedPoints = questions.reduce(
      (sum, q) => sum + (q.points || 0),
      0
    );
    const finalPoints = total_points || calculatedPoints;

    // Create assessment transaction
    const result = await prisma.$transaction(async (prisma) => {
      // Create the assessment
      const assessment = await prisma.assessment.create({
        data: {
          course_id: parseInt(course_id),
          lesson_id: parseInt(lesson_id),
          title,
          description,
          assessment_type,
          total_points: finalPoints,
          time_limit: parseInt(time_limit) || 30,
          attempt_limit: parseInt(attempt_limit) || 1,
          date_open: date_open ? new Date(date_open) : null,
          date_close: date_close ? new Date(date_close) : null,
        },
      });

      // Create questions and their options
      const createdQuestions = await Promise.all(
        questions.map(async (question) => {
          const createdQuestion = await prisma.question.create({
            data: {
              assessment_id: assessment.id,
              question: question.question,
              type: question.type,
              points: question.points || 1,
            },
          });

          if (
            question.options &&
            question.options.length > 0
          ) {
            await prisma.questionOption.createMany({
              data: question.options.map((option) => ({
                question_id: createdQuestion.id,
                description: option.description,
                is_correct: option.is_correct || false,
              })),
            });
          }

          return createdQuestion;
        })
      );

      return { assessment, questions: createdQuestions };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating assessment:", error);
    res.status(500).json({ error: "Failed to create assessment" });
  }
});

// Get assessment by ID
router.get("/:id", async (req, res) => {
  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    });

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    res.json(assessment);
  } catch (error) {
    console.error("Error fetching assessment:", error);
    res.status(500).json({ error: "Failed to fetch assessment" });
  }
});

// Get assessments by lesson ID
router.get("/list/:lessonId", async (req, res) => {
  try {
    const assessments = await prisma.assessment.findMany({
      where: { lesson_id: parseInt(req.params.lessonId) },
      orderBy: { created_at: "desc" },
    });

    res.json(assessments);
  } catch (error) {
    console.error("Error fetching assessments:", error);
    res.status(500).json({ error: "Failed to fetch assessments" });
  }
});

// Update assessment
router.put("/:id", async (req, res) => {
  const assessmentId = parseInt(req.params.id);

  const {
    title,
    description,
    assessment_type,
    total_points,
    time_limit,
    attempt_limit,
    course_id,
    lesson_id,
    questions,
    date_open,
    date_close,
  } = req.body;

  if (!title || !assessment_type || !course_id || !lesson_id) {
    return res.status(400).json({
      error: "Title, assessment type, course ID, and lesson ID are required",
    });
  }

  if (!questions || questions.length === 0) {
    return res.status(400).json({
      error: "At least one question is required",
    });
  }

  try {
    const updated = await prisma.$transaction(async (prisma) => {
      // Update assessment
      const updatedAssessment = await prisma.assessment.update({
        where: { id: assessmentId },
        data: {
          title,
          description,
          assessment_type,
          course_id: parseInt(course_id),
          lesson_id: parseInt(lesson_id),
          total_points: total_points || questions.reduce((sum, q) => sum + (q.points || 0), 0),
          time_limit: parseInt(time_limit) || 30,
          attempt_limit: parseInt(attempt_limit) || 1,
          date_open: date_open ? new Date(date_open) : null,
          date_close: date_close ? new Date(date_close) : null,
        },
      });

      // Fetch existing questions
      const existingQuestions = await prisma.question.findMany({
        where: { assessment_id: assessmentId },
        include: { options: true },
      });

      const existingQuestionIds = existingQuestions.map((q) => q.id);
      const incomingQuestionIds = questions.filter(q => q.id).map((q) => q.id);

      // Delete removed questions
      const toDeleteIds = existingQuestionIds.filter(id => !incomingQuestionIds.includes(id));
      await prisma.questionOption.deleteMany({
        where: { question_id: { in: toDeleteIds } },
      });
      await prisma.question.deleteMany({
        where: { id: { in: toDeleteIds } },
      });

      // Process each question
      for (const q of questions) {
        if (q.id) {
          // Update existing question
          await prisma.question.update({
            where: { id: q.id },
            data: {
              question: q.question,
              type: q.type,
              points: q.points || 1,
            },
          });

          // Delete existing options
          await prisma.questionOption.deleteMany({
            where: { question_id: q.id },
          });

          // Recreate options
          if (q.options?.length > 0) {
            await prisma.questionOption.createMany({
              data: q.options.map((opt) => ({
                question_id: q.id,
                description: opt.description,
                is_correct: opt.is_correct || false,
              })),
            });
          }
        } else {
          // New question
          const newQuestion = await prisma.question.create({
            data: {
              assessment_id: assessmentId,
              question: q.question,
              type: q.type,
              points: q.points || 1,
            },
          });

          if (q.options?.length > 0) {
            await prisma.questionOption.createMany({
              data: q.options.map((opt) => ({
                question_id: newQuestion.id,
                description: opt.description,
                is_correct: opt.is_correct || false,
              })),
            });
          }
        }
      }

      return updatedAssessment;
    });

    return res.json({ message: "Assessment updated", assessment: updated });
  } catch (error) {
    console.error("Error updating assessment:", error);
    return res.status(500).json({ error: "Failed to update assessment" });
  }
});


// Delete assessment
router.delete("/:id", async (req, res) => {
  try {
    await prisma.$transaction(async (prisma) => {
      const questions = await prisma.question.findMany({
        where: { assessment_id: parseInt(req.params.id) },
      });

      await Promise.all(
        questions.map((question) =>
          prisma.questionOption.deleteMany({
            where: { question_id: question.id },
          })
        )
      );

      await prisma.question.deleteMany({
        where: { assessment_id: parseInt(req.params.id) },
      });

      await prisma.assessment.delete({
        where: { id: parseInt(req.params.id) },
      });
    });

    res.status(204).end();
  } catch (error) {
    console.error("Error deleting assessment:", error);
    res.status(500).json({ error: "Failed to delete assessment" });
  }
});

module.exports = router;
