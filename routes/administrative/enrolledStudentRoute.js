// routes/administrative/enrolledStudentRoutes.js
const express = require("express");
const prisma = require("../../models/prisma");
const router = express.Router();

// 📌 Enroll multiple students and auto-assign courses
router.post("/", async (req, res) => {
  const students = req.body;

  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ message: "Request body must be a non-empty array of students." });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const enrolledResults = [];

      for (const student of students) {
        // Step 1: Create enrolled student
        const enrolledStudent = await tx.enrolledStudent.create({
          data: {
            term: student.term,
            student_session_id: student.student_session_id,
            student_id: student.student_id,
            session_id: student.session_id,
            firstname: student.firstname,
            lastname: student.lastname,
            middlename: student.middlename || null,
            gender: student.gender || null,
            year_level: student.year_level,
          },
        });

        // Step 2: Fetch courses matching the student's year_level and term
        const matchingCourses = await tx.course.findMany({
          where: {
            year_level: student.year_level,
            term: student.term,
          },
        });

        // Step 3: Assign courses to the enrolled student
        await tx.studentAssignCourses.createMany({
          data: matchingCourses.map((course) => ({
            term: student.term,
            enrolled_student_id: enrolledStudent.id,
            course_id: course.id,
          })),
        });

        enrolledResults.push(enrolledStudent);
      }

      return enrolledResults;
    });

    res.status(201).json(result);
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
    year_level,
    gender
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
        gender,
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


// 📌 Get students by faculty_id and term
router.get("/by-faculty/:facultyId/term/:term", async (req, res) => {
  const { facultyId, term } = req.params;

  try {
    // Step 1: Find all course IDs assigned to the faculty for the given term
    const courses = await prisma.course.findMany({
      where: {
        faculty_id: parseInt(facultyId),
        term: term,
      },
      select: {
        id: true,
      },
    });

    const courseIds = courses.map((course) => course.id);

    if (courseIds.length === 0) {
      return res.status(200).json([]); // No courses = no students
    }

    // Step 2: Find all student assignments for these courses
    const studentAssignments = await prisma.studentAssignCourses.findMany({
      where: {
        term: term,
        course_id: { in: courseIds },
      },
      include: {
        enrolledStudent: true,
      },
    });

    // Step 3: Deduplicate students by enrolled_student_id
    const uniqueStudentsMap = new Map();

    studentAssignments.forEach(({ enrolledStudent }) => {
      if (!uniqueStudentsMap.has(enrolledStudent.id)) {
        uniqueStudentsMap.set(enrolledStudent.id, enrolledStudent);
      }
    });

    const uniqueStudents = Array.from(uniqueStudentsMap.values());

    res.json(uniqueStudents);
  } catch (error) {
    console.error("Error fetching students by faculty and term:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// 📌 Delete a student by ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const studentId = parseInt(id);

    // Delete related StudentAssignCourses
    await prisma.studentAssignCourses.deleteMany({
      where: { enrolled_student_id: studentId },
    });

    // Delete related StudentPerformanceTask
    await prisma.studentPerformanceTask.deleteMany({
      where: { student_id: studentId },
    });

    // Now delete the EnrolledStudent
    await prisma.enrolledStudent.delete({
      where: { id: studentId },
    });

    res.status(200).json({ message: `Student with ID ${id} deleted successfully.` });
  } catch (error) {
    console.error("Error deleting student:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Student not found" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});



module.exports = router;
