// routes/administrative/coursesRoute.js
const express = require("express");
const prisma = require("../../models/prisma");
const router = express.Router();

// 📌 Create a new Course
router.post("/", async (req, res) => {
  const {
    term,
    title,
    description,
    faculty_id,
    faculty_full_name,
    year_level,
  } = req.body;

  try {
    // Create the course
    const newCourse = await prisma.course.create({
      data: {
        term,
        title,
        description,
        faculty_id,
        faculty_full_name,
        year_level,
      },
    });

    res.status(201).json(newCourse);
  } catch (error) {
    console.error("Error creating course:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 📌 GET Courses (optionally filter by term)
router.get("/", async (req, res) => {
  const { term } = req.query;

  try {
    const whereClause = {};

    if (term) whereClause.term = term;

    const courses = await prisma.course.findMany({
      where: Object.keys(whereClause).length ? whereClause : undefined,
      orderBy: { created_at: "desc" },
    });

    res.status(200).json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 📌 GET Courses by required term and faculty_id from route path
router.get("/faculty/term=:term/faculty_id=:faculty_id", async (req, res) => {
  const { term, faculty_id } = req.params;

  try {
    const courses = await prisma.course.findMany({
      where: {
        term,
        faculty_id: parseInt(faculty_id, 10),
      },
      orderBy: {
        created_at: "desc",
      },
    });

    res.status(200).json(courses);
  } catch (error) {
    console.error("Error fetching courses by faculty and term:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 📌 Get all active teachers
router.get("/teachers", async (req, res) => {
  try {
    const teachers = await prisma.user.findMany({
      where: {
        role: "teacher",
        status: "active",
      },
    });

    const formattedTeachers = teachers.map((teacher) => {
      const middleInitial =
        typeof teacher.middlename === "string" && teacher.middlename.length > 0
          ? `${teacher.middlename.charAt(0).toUpperCase()}.`
          : "";

      const fullName =
        `${teacher.firstname} ${middleInitial} ${teacher.lastname}`.trim();

      return {
        user_id: teacher.id,
        full_name: fullName,
      };
    });

    res.status(200).json(formattedTeachers);
  } catch (error) {
    console.error("Error fetching teachers:", error.message, error.stack);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 📌 GET Course by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const course = await prisma.course.findUnique({
      where: {
        id: parseInt(id),
      },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.status(200).json(course);
  } catch (error) {
    console.error("Error fetching course by ID:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 📌 Update an existing Course
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    term,
    title,
    description,
    faculty_id,
    faculty_full_name,
    year_level,
  } = req.body;

  try {
    const existingCourse = await prisma.course.findUnique({
      where: { id: Number(id) },
    });

    if (!existingCourse) {
      return res.status(404).json({ message: "Course not found" });
    }

    const updatedCourse = await prisma.course.update({
      where: { id: Number(id) },
      data: {
        term,
        title,
        description,
        faculty_id,
        faculty_full_name,
        year_level,
      },
    });

    res.status(200).json(updatedCourse);
  } catch (error) {
    console.error("Error updating course:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 📌 Delete a Course by ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const courseId = Number(id);

    const existingCourse = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!existingCourse) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Step 1: Get all lesson IDs under the course
    const lessons = await prisma.lesson.findMany({
      where: { course_id: courseId },
      select: { id: true },
    });

    const lessonIds = lessons.map((l) => l.id);

    // Step 2: Delete dependent entities of lessons
    if (lessonIds.length > 0) {
      await prisma.content.deleteMany({
        where: { lesson_id: { in: lessonIds } },
      });

      await prisma.assessment.deleteMany({
        where: { lesson_id: { in: lessonIds } },
      });
    }

    // Step 3: Delete lessons
    await prisma.lesson.deleteMany({
      where: { course_id: courseId },
    });

    // Step 4: Delete other course-related entities
// await prisma.ebook.deleteMany({ where: { course_id: courseId } });
    await prisma.assessment.deleteMany({ where: { course_id: courseId } });
    await prisma.performanceTaskScore.deleteMany({ where: { course_id: courseId } });
    await prisma.studentAssignCourses.deleteMany({ where: { course_id: courseId } });

    // Step 5: Finally, delete the course itself
    await prisma.course.delete({
      where: { id: courseId },
    });

    res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



module.exports = router;
