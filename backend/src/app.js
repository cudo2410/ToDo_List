require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const taskRoutes = require('./routes/task.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tasks', taskRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Todo List API is running',
  });
});

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT DATABASE() AS databaseName, 1 AS connected',
    );

    res.json({
      status: 'ok',
      database: rows[0].databaseName,
      mysql: 'connected',
    });
  } catch (error) {
    console.error('MySQL connection error:', error.message);

    res.status(500).json({
      status: 'error',
      message: 'Cannot connect to MySQL',
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
