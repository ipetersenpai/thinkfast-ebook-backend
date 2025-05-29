const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const path = require("path");
const userRoutes = require("./routes/superadmin/userRoute");
const globalRoutes = require("./routes/global/globalRoutes");
const authRoutes = require("./routes/authRoute");
const academicYearRoutes = require("./routes/administrative/academicYearRoute");
const coursesRoutes = require("./routes/administrative/coursesRoute");
const enrolledStudentRoutes = require("./routes/administrative/enrolledStudentRoute");
const assignCourseRoutes = require("./routes/administrative/assignCourseRoute");
const eBooksRoutes = require("./routes/superadmin/ebookRoute");
const lessonBuilderRoutes = require("./routes/faculty/lessonBuilderRoute");
const assessmentRoutes = require("./routes/faculty/assessmentRoute");
const videoGalleryRoutes = require("./routes/superadmin/videoGalleryRoute");
const enrolledCoursesRoutes = require("./routes/student/enrolledCoursesRoute");
const performanceTaskRoutes = require("./routes/faculty/performanceTaskRoute");

require("dotenv").config();

const app = express();
const PORT = 3500;

app.use(express.json());
// Serve static uploads folder here:
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CORS to allow frontend requests
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  let token = req.headers["authorization"];

  if (!token) {
    return res.status(403).send("A token is required for authentication");
  }

  // Handle both "Bearer <token>" and "<token>"
  if (token.startsWith("Bearer ")) {
    token = token.slice(7, token.length).trim();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("JWT verification failed:", err);
      return res.status(403).send("Invalid or expired token");
    }
    req.user = decoded; // attach decoded payload to request
    next();
  });
};

// Routes for authentication (login, signup)
app.use("/api/auth", authRoutes);

// Protected routes for Courses
app.use("/api/courses", verifyToken, coursesRoutes);

// Protected routes for Enrolled Student
app.use("/api/enroll-student", verifyToken, enrolledStudentRoutes);

// Protected routes for Assign Course
app.use("/api/assign-course", verifyToken, assignCourseRoutes);

// Protected routes for academic year
app.use("/api/academic_year", verifyToken, academicYearRoutes);

// Protected routes for ebook
app.use("/api/ebook", verifyToken, eBooksRoutes);

// Protected routes for video gallery
app.use("/api/video-gallery", verifyToken, videoGalleryRoutes);

// Protected routes for lesson builder
app.use("/api/lesson-builder", verifyToken, lessonBuilderRoutes);

// Protected routes for assessments
app.use("/api/assessment", verifyToken, assessmentRoutes);

// Protected routes for performance tasks
app.use("/api/performance-task", verifyToken, performanceTaskRoutes);

// Protected routes for superadmin users
app.use("/api/users", verifyToken, userRoutes);

// Protected routes for global user data
app.use("/api/get-user", verifyToken, globalRoutes);



// ========================
// Protected routes for tablets
// ========================


app.use("/api/student", verifyToken, enrolledCoursesRoutes);



// Optional test route to confirm token decoding works
app.get("/api/test", verifyToken, (req, res) => {
  res.json({
    message: "Token is valid",
    user: req.user,
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
