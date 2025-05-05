const express = require('express');
const userRoutes = require('./routes/superadmin/userRoutes');

const app = express();
const PORT = 3500;

app.use(express.json());

// API routes
app.use('/api/users', userRoutes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
