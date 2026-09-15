const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./openapi.json');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Stage 5: Serve Swagger UI at /docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Helper function to format database row into clean API task response object
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

app.get('/health', (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Stage 1: Read endpoints backed by SQLite
app.get('/tasks', (req, res) => {
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  // Extra: Filter by status using SQL WHERE done = ?
  if (req.query.done !== undefined) {
    query += ' AND done = ?';
    params.push(req.query.done === 'true' ? 1 : 0);
  }

  // Extra: Search by title using SQL WHERE title LIKE ?
  if (req.query.search) {
    query += ' AND title LIKE ?';
    params.push(`%${req.query.search}%`);
  }

  query += ' ORDER BY id ASC';

  const rows = db.prepare(query).all(...params);
  const tasks = rows.map(formatTask);
  res.status(200).json(tasks);
});

// Extra: Statistics endpoint using SQL aggregates
app.get('/stats', (req, res) => {
  const statsRow = db.prepare(`
    SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done,
      SUM(CASE WHEN done = 0 THEN 1 ELSE 0 END) AS open
    FROM tasks
  `).get();

  res.status(200).json({
    total: statsRow.total || 0,
    done: statsRow.done || 0,
    open: statsRow.open || 0
  });
});

// Extra: Seed & Reset endpoint using SQL transaction
app.post('/reset', (req, res) => {
  const resetTx = db.transaction(() => {
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run('tasks');

    const insertStmt = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
    insertStmt.run('Learn Express basics', 1);
    insertStmt.run('Build CRUD API endpoints', 0);
    insertStmt.run('Test API with Swagger UI', 0);
  });

  resetTx();
  const rows = db.prepare('SELECT * FROM tasks ORDER BY id ASC').all();
  res.status(200).json({
    message: "Database reset to initial 3 seed tasks",
    tasks: rows.map(formatTask)
  });
});

app.get('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

  if (!row) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }

  res.status(200).json(formatTask(row));
});

// Stage 2: Create task with SQL INSERT and validation
app.post('/tasks', (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: "Title is required and must be a non-empty string" });
  }

  const cleanTitle = title.trim();
  const stmt = db.prepare('INSERT INTO tasks (title, done) VALUES (?, 0)');
  const info = stmt.run(cleanTitle);

  const newRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(formatTask(newRow));
});

// Stage 3: Update task with SQL UPDATE
app.put('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existingRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

  if (!existingRow) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }

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
  const newDone = done !== undefined ? (done ? 1 : 0) : existingRow.done;

  db.prepare(`
    UPDATE tasks 
    SET title = ?, done = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(newTitle, newDone, id);

  const updatedRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(200).json(formatTask(updatedRow));
});

// Stage 3: Delete task with SQL DELETE
app.delete('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existingRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

  if (!existingRow) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.status(204).send();
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Swagger UI documentation available at http://localhost:${PORT}/docs`);
  });
}

module.exports = app;
