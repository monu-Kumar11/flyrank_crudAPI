require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./openapi.json');
const db = require('./pg_db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Stage 5: Serve Swagger UI at /docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Helper function to format PostgreSQL row into clean API task response object
function formatTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    done: Boolean(row.done),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// Stage 1: Root and health endpoints
app.get('/', (req, res) => {
  res.status(200).json({
    name: "Task API",
    version: "1.0",
    endpoints: ["/tasks", "/health", "/docs", "/stats", "/reset"]
  });
});

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({ status: "ok", db: "ok" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

// Stage 2: Read endpoints backed by PostgreSQL
app.get('/tasks', async (req, res) => {
  try {
    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    // Filter by status using SQL WHERE done = $1
    if (req.query.done !== undefined) {
      query += ` AND done = $${paramIdx++}`;
      params.push(req.query.done === 'true');
    }

    // Search by title using SQL WHERE title ILIKE $2
    if (req.query.search) {
      query += ` AND title ILIKE $${paramIdx++}`;
      params.push(`%${req.query.search}%`);
    }

    query += ' ORDER BY id ASC';

    const result = await db.query(query, params);
    const tasks = result.rows.map(formatTask);
    res.status(200).json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }

    res.status(200).json(formatTask(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Swagger UI documentation available at http://localhost:${PORT}/docs`);
  });
}

module.exports = app;
