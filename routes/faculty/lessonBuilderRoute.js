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
    } = req.body;

    // Step 1: Find the max order_no for this course
    const lastLesson = await prisma.lesson.findFirst({
      where: { course_id },
      orderBy: { order_no: "desc" },
      select: { order_no: true },
    });

    const nextOrderNo = lastLesson?.order_no ? lastLesson.order_no + 1 : 1;

    // Step 2: Create the Lesson
    const newLesson = await prisma.lesson.create({
      data: {
        title,
        description,
        course_id,
        order_no: nextOrderNo,
        is_active,
      },
    });

    // Step 3: Create the related Content (optional)
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
      res.status(500).json({ error: "An error occurred while fetching the lesson." });
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
      ebooks_id,
      attachment_links = [],
    } = req.body;

    // Step 1: Update the Lesson's core fields
    const updatedLesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title,
        description,
        is_active, // ← Update is_active
      },
    });

    // Step 2: Update or create the associated content
    const existingContent = await prisma.content.findUnique({
      where: { lesson_id: lessonId },
    });

    if (existingContent) {
      // If content exists, update it
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
      // If no content, create it
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




module.exports = router;
