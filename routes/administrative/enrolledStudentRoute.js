// routes/administrative/enrolledStudentRoutes.js
const express = require("express");
const prisma = require("../../models/prisma");
const router = express.Router();

// 📌 Enroll multiple students
router.post("/", async (req, res) => {
  const students = req.body;

  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ message: "Request body must be a non-empty array of students." });
  }

  try {
    const newEnrolledStudents = await prisma.$transaction(
      students.map((student) =>
        prisma.enrolledStudent.create({
          data: {
            term: student.term,
            student_session_id: student.student_session_id,
            student_id: student.student_id,
            session_id: student.session_id,
            firstname: student.firstname,
            lastname: student.lastname,
            middlename: student.middlename || null,
            year_level: student.year_level,
          },
        })
      )
    );

    res.status(201).json(newEnrolledStudents);
  } catch (error) {
    console.error("Error enrolling students:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 📌 Get all students by term
router.get("/term/:term", async (req, res) => {
  const { term } = req.params;

  try {
    // Fetch all students for the term
    const students = await prisma.enrolledStudent.findMany({
      where: { term },
      orderBy: { lastname: "asc" },
    });

    // For each student, count their assigned courses in the same term
    const studentsWithAssignedCount = await Promise.all(
      students.map(async (student) => {
        const total_assigned_course = await prisma.studentAssignCourses.count({
          where: {
            enrolled_student_id: student.id,
            term: student.term,
          },
        });

        return {
          ...student,
          total_assigned_course,
        };
      })
    );

    res.json(studentsWithAssignedCount);
  } catch (error) {
    console.error("Error fetching students by term:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 📌 Get a single student by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const student = await prisma.enrolledStudent.findUnique({
      where: { id: parseInt(id) }
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json(student);
  } catch (error) {
    console.error("Error fetching student by ID:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 📌 Update a student by ID
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    term,
    student_session_id,
    student_id,
    session_id,
    firstname,
    lastname,
    middlename,
    year_level
  } = req.body;

  try {
    const updatedStudent = await prisma.enrolledStudent.update({
      where: { id: parseInt(id) },
      data: {
        term,
        student_session_id,
        student_id,
        session_id,
        firstname,
        lastname,
        middlename: middlename || null,
        year_level
      }
    });

    res.json(updatedStudent);
  } catch (error) {
    console.error("Error updating student:", error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: "Student not found" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

// 📌 Delete a student by ID
router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    try {
      await prisma.enrolledStudent.delete({
        where: { id: parseInt(id) }
      });

      res.status(200).json({ message: `Student with ID ${id} deleted successfully.` });
    } catch (error) {
      console.error("Error deleting student:", error);
      if (error.code === 'P2025') {
        return res.status(404).json({ message: "Student not found" });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });


module.exports = router;
