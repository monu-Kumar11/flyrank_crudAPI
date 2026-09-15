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

// Extra: Statistics endpoint using SQL aggregates
app.get('/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*)::int AS total,
        SUM(CASE WHEN done = true THEN 1 ELSE 0 END)::int AS done,
        SUM(CASE WHEN done = false THEN 1 ELSE 0 END)::int AS open
      FROM tasks
    `);
    const row = result.rows[0];
    res.status(200).json({
      total: row.total || 0,
      done: row.done || 0,
      open: row.open || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Extra: Reset endpoint
app.post('/reset', async (req, res) => {
  try {
    await db.query('TRUNCATE TABLE tasks RESTART IDENTITY;');
    await db.query(`
      INSERT INTO tasks (title, done) VALUES 
      ('Learn Express basics', true),
      ('Build CRUD API endpoints', false),
      ('Test API with Swagger UI', false);
    `);
    const result = await db.query('SELECT * FROM tasks ORDER BY id ASC;');
    res.status(200).json({
      message: "Database reset to initial 3 seed tasks",
      tasks: result.rows.map(formatTask)
    });
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

// Stage 3: Create task with SQL INSERT and RETURNING *
app.post('/tasks', async (req, res) => {
  try {
    const { title } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: "Title is required and must be a non-empty string" });
    }

    const cleanTitle = title.trim();
    const result = await db.query(
      'INSERT INTO tasks (title, done) VALUES ($1, false) RETURNING *',
      [cleanTitle]
    );

    res.status(201).json(formatTask(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stage 3: Update task with SQL UPDATE and RETURNING *
app.put('/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const checkRes = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }

    const existingRow = checkRes.rows[0];
    const { title, done } = req.body;

    if (title === undefined && done === undefined) {
      return res.status(400).json({ error: "At least one of 'title' or 'done' must be provided for update" });
    }

    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
      return res.status(400).json({ error: "Title must be a non-empty string" });
    }

    if (done !== undefined && typeof done !== 'boolean') {
      return res.status(400).json({ error: "Done status must be a boolean" });
    }

    const newTitle = title !== undefined ? title.trim() : existingRow.title;
    const newDone = done !== undefined ? done : existingRow.done;

    const updateRes = await db.query(
      'UPDATE tasks SET title = $1, done = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [newTitle, newDone, id]
    );

    res.status(200).json(formatTask(updateRes.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stage 3: Delete task with SQL DELETE
app.delete('/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleteRes = await db.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: `Task ${req.params.id} not found` });
    }

    res.status(204).send();
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
