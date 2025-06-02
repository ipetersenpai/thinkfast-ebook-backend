// routes/faculty/lessonBuilderRoute.js
const express = require("express");
const prisma = require("../../models/prisma");
const router = express.Router();

// POST /api/lesson-builder
router.post("/", async (req, res) => {
  try {
    const {
      title,
      description,
      course_id,
      ebooks_id,
      is_active = false,
      attachment_links = [],
      order_no,
    } = req.body;

    // Validate order_no
    if (order_no === undefined || typeof order_no !== "number") {
      return res.status(400).json({
        error: "Missing or invalid 'order_no' in request body.",
      });
    }

    // Check if order_no already exists for this course
    const existingLesson = await prisma.lesson.findFirst({
      where: {
        course_id,
        order_no,
      },
    });

    if (existingLesson) {
      return res.status(409).json({
        error: `Order number ${order_no} is already used in this course.`,
      });
    }

    // Create the Lesson
    const newLesson = await prisma.lesson.create({
      data: {
        title,
        description,
        course_id,
        order_no,
        is_active,
      },
    });

    // Create related Content
    await prisma.content.create({
      data: {
        lesson_id: newLesson.id,
        ebooks_id: ebooks_id || null,
        attachment_link_1: attachment_links[0] || null,
        attachment_link_2: attachment_links[1] || null,
        attachment_link_3: attachment_links[2] || null,
        attachment_link_4: attachment_links[3] || null,
      },
    });

    res.status(201).json({
      message: "Lesson created successfully",
      lesson: newLesson,
    });
  } catch (error) {
    console.error("Error creating lesson:", error);
    res.status(500).json({
      error: "An error occurred while creating the lesson.",
    });
  }
});

// GET /api/faculty/lessons/:course_id
router.get("/:course_id", async (req, res) => {
  const { course_id } = req.params;

  try {
    const lessons = await prisma.lesson.findMany({
      where: { course_id: Number(course_id) },
      orderBy: { order_no: "asc" },
      include: {
        content: true, // includes associated content if available
      },
    });

    res.status(200).json({ lessons });
  } catch (error) {
    console.error("Error fetching lessons:", error);
    res.status(500).json({
      error: "An error occurred while fetching the lessons.",
    });
  }
});

// GET /api/lesson-builder/:id
router.get("/lesson/:id", async (req, res) => {
  const lessonId = parseInt(req.params.id, 10);

  if (isNaN(lessonId)) {
    return res.status(400).json({ error: "Invalid lesson ID" });
  }

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        content: true, // includes related content (ebooks_id, attachments)
      },
    });

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    res.status(200).json({ lesson });
  } catch (error) {
    console.error("Error fetching lesson:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching the lesson." });
  }
});

// PUT /api/lesson-builder/:id
router.put("/:id", async (req, res) => {
  try {
    const lessonId = Number(req.params.id);
    const {
      title,
      description,
      is_active,
      order_no,
      ebooks_id,
      attachment_links = [],
    } = req.body;

    // Step 0: Validate order_no
    if (order_no === undefined || typeof order_no !== "number") {
      return res.status(400).json({
        error: "Missing or invalid 'order_no' in request body.",
      });
    }

    // Step 1: Get current lesson to retrieve course_id
    const existingLesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!existingLesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    // Step 2: Check for order_no conflict in the same course (excluding current lesson)
    const conflictLesson = await prisma.lesson.findFirst({
      where: {
        course_id: existingLesson.course_id,
        order_no,
        NOT: { id: lessonId },
      },
    });

    if (conflictLesson) {
      return res.status(409).json({
        error: `Order number ${order_no} is already used in this course.`,
      });
    }

    // Step 3: Update the Lesson
    const updatedLesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title,
        description,
        is_active,
        order_no,
      },
    });

    // Step 4: Update or create associated content
    const existingContent = await prisma.content.findUnique({
      where: { lesson_id: lessonId },
    });

    if (existingContent) {
      await prisma.content.update({
        where: { lesson_id: lessonId },
        data: {
          ebooks_id: ebooks_id || null,
          attachment_link_1: attachment_links[0] || null,
          attachment_link_2: attachment_links[1] || null,
          attachment_link_3: attachment_links[2] || null,
          attachment_link_4: attachment_links[3] || null,
        },
      });
    } else {
      await prisma.content.create({
        data: {
          lesson_id: lessonId,
          ebooks_id: ebooks_id || null,
          attachment_link_1: attachment_links[0] || null,
          attachment_link_2: attachment_links[1] || null,
          attachment_link_3: attachment_links[2] || null,
          attachment_link_4: attachment_links[3] || null,
        },
      });
    }

    res.status(200).json({
      message: "Lesson updated successfully",
      lesson: updatedLesson,
    });
  } catch (error) {
    console.error("Error updating lesson:", error);
    res.status(500).json({
      error: "An error occurred while updating the lesson.",
    });
  }
});


// DELETE /api/lesson-builder/:id
router.delete("/:id", async (req, res) => {
  const lessonId = Number(req.params.id);

  if (isNaN(lessonId)) {
    return res.status(400).json({ error: "Invalid lesson ID" });
  }

  try {
    // Step 1: Find all assessments linked to this lesson
    const assessments = await prisma.assessment.findMany({
      where: { lesson_id: lessonId },
      select: { id: true },
    });

    const assessmentIds = assessments.map((a) => a.id);

    // Step 2: Get all question IDs linked to these assessments
    const questions = await prisma.question.findMany({
      where: {
        assessment_id: { in: assessmentIds },
      },
      select: { id: true },
    });

    const questionIds = questions.map((q) => q.id);

    // Step 3: Get all user attempt IDs
    const userAttempts = await prisma.userAttempt.findMany({
      where: {
        assessment_id: { in: assessmentIds },
      },
      select: { id: true },
    });

    const userAttemptIds = userAttempts.map((ua) => ua.id);

    // Step 4: Delete all user answers
    await prisma.userAnswer.deleteMany({
      where: {
        OR: [
          { question_id: { in: questionIds } },
          { user_attempt_id: { in: userAttemptIds } },
        ],
      },
    });

    // Step 5: Delete all user attempts
    await prisma.userAttempt.deleteMany({
      where: {
        id: { in: userAttemptIds },
      },
    });

    // Step 6: Delete all question options
    await prisma.questionOption.deleteMany({
      where: {
        question_id: { in: questionIds },
      },
    });

    // Step 7: Delete all questions
    await prisma.question.deleteMany({
      where: {
        id: { in: questionIds },
      },
    });

    // Step 8: Delete assessments
    await prisma.assessment.deleteMany({
      where: {
        id: { in: assessmentIds },
      },
    });

    // Step 9: Delete content
    await prisma.content.deleteMany({
      where: {
        lesson_id: lessonId,
      },
    });

    // Step 10: Delete the lesson itself
    await prisma.lesson.delete({
      where: {
        id: lessonId,
      },
    });

    res.status(200).json({ message: "Lesson and all related data deleted successfully" });
  } catch (error) {
    console.error("Error deleting lesson and related data:", error);
    res.status(500).json({
      error: "An error occurred while deleting the lesson and related data.",
    });
  }
});


module.exports = router;
