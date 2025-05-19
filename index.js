const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const userRoutes = require("./routes/superadmin/userRoutes");
const globalRoutes = require("./routes/global/globalRoutes");
const authRoutes = require("./routes/authRoutes");
const academicYearRoutes = require("./routes/administrative/academicYearRoutes");
const coursesRoutes = require("./routes/administrative/coursesRoute");

require("dotenv").config();

const app = express();
const PORT = 3500;

app.use(express.json());

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
    req.user = decoded;  // attach decoded payload to request
    next();
  });
};

// Routes for authentication (login, signup)
app.use("/api/auth", authRoutes);

// Protected routes for Courses
app.use("/api/courses", verifyToken, coursesRoutes);

// Protected routes for academic year
app.use("/api/academic_year", verifyToken, academicYearRoutes);

// Protected routes for superadmin users
app.use("/api/users", verifyToken, userRoutes);

// Protected routes for global user data
app.use("/api/get-user", verifyToken, globalRoutes);

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
