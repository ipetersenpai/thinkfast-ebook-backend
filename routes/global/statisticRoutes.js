const express = require('express');
const prisma = require('../../models/prisma');
const router = express.Router();

router.get("/students/total", async (req, res) => {
  try {
    // Get the active academic year
    const currentYear = await prisma.academic_Year.findFirst({
      where: { status: "active" },
      orderBy: { start_date: "desc" },
    });

    if (!currentYear) {
      return res
        .status(404)
        .json({ message: "No active academic year found." });
    }

    // Get the previous academic year (by start_date)
    const previousYear = await prisma.academic_Year.findFirst({
      where: {
        start_date: { lt: currentYear.start_date },
      },
      orderBy: { start_date: "desc" },
    });

    // Count enrolled students for current academic year
    const currentTotal = await prisma.enrolledStudent.count({
      where: {
        term: currentYear.term,
      },
    });

    // Count for previous year (default to 0 if not found)
    let previousTotal = 0;

    if (previousYear) {
      previousTotal = await prisma.enrolledStudent.count({
        where: {
          term: previousYear.term,
        },
      });
    }

    // Calculate percentage change
    let percentChange = 0;
    if (previousTotal > 0) {
      percentChange = ((currentTotal - previousTotal) / previousTotal) * 100;
    }

    return res.json({
      current_term: currentYear.term,
      current_total: currentTotal,
      previous_term: previousYear ? previousYear.term : null,
      previous_total: previousTotal,
      percent_change: `${percentChange.toFixed(2)}%`,
    });
  } catch (error) {
    console.error("Error comparing student enrollment:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});


router.get("/courses/total", async (req, res) => {
  try {
    // Get the active academic year
    const currentYear = await prisma.academic_Year.findFirst({
      where: { status: "active" },
      orderBy: { start_date: "desc" },
    });

    if (!currentYear) {
      return res
        .status(404)
        .json({ message: "No active academic year found." });
    }

    // Count the total courses offered in the current term
    const totalCourses = await prisma.course.count({
      where: {
        term: currentYear.term,
      },
    });

    return res.json({
      total_courses: totalCourses,
      academic_year_description: currentYear.description,
    });
  } catch (error) {
    console.error("Error fetching total courses:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

router.get("/ebooks/total", async (req, res) => {
  try {
    const totalEbooks = await prisma.ebooks.count();

    return res.json({
      total_ebooks: totalEbooks
    });
  } catch (error) {
    console.error("Error fetching total ebooks:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

router.get("/students/gender-summary/:facultyId", async (req, res) => {
  const facultyId = parseInt(req.params.facultyId);

  try {
    // Step 0: Get the active academic year
    const activeYear = await prisma.academic_Year.findFirst({
      where: { status: "active" },
      orderBy: { start_date: "desc" },
    });

    if (!activeYear) {
      return res.status(404).json({ message: "No active academic year found." });
    }

    const activeTerm = activeYear.term;

    // Step 1: Get all courses taught by this faculty in the active term
    const facultyCourses = await prisma.course.findMany({
      where: {
        faculty_id: facultyId,
        term: activeTerm,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (facultyCourses.length === 0) {
      return res.json([]);
    }

    // Step 2: For each course, count male and female students
    const genderSummaryPromises = facultyCourses.map(async (course) => {
      const assignments = await prisma.studentAssignCourses.findMany({
        where: {
          course_id: course.id,
          term: activeTerm,
        },
        select: {
          enrolledStudent: {
            select: {
              gender: true,
              term: true,
            },
          },
        },
      });

      let male = 0;
      let female = 0;

      assignments.forEach(({ enrolledStudent }) => {
        if (enrolledStudent.term !== activeTerm) return; // extra safety
        const gender = enrolledStudent.gender?.toLowerCase();
        if (gender === "male") male++;
        else if (gender === "female") female++;
      });

      return {
        course_id: course.id,
        course_title: course.title,
        male,
        female,
      };
    });

    const results = await Promise.all(genderSummaryPromises);

    res.json(results);
  } catch (error) {
    console.error("Error fetching gender summary per course:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});


router.get("/users/total", async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();

    return res.json({
      total_user: totalUsers,
    });
  } catch (error) {
    console.error("Error fetching total users:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});



module.exports = router;
