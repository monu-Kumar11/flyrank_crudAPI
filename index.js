const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./openapi.json');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Stage 5: Serve Swagger UI at /docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Initial default tasks seed dataset
const DEFAULT_TASKS = [
  { id: 1, title: "Learn Express basics", done: true },
  { id: 2, title: "Build CRUD API endpoints", done: false },
  { id: 3, title: "Test API with Swagger UI", done: false }
];

// In-memory data store
let tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
let nextId = 4;

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

// Stage 2 & Extras: List tasks with filtering and search
app.get('/tasks', (req, res) => {
  let result = [...tasks];

  // Extra: Query parameter filtering by 'done' status (?done=true/false)
  if (req.query.done !== undefined) {
    const isDone = req.query.done === 'true';
    result = result.filter(t => t.done === isDone);
  }

  // Extra: Query parameter search by title (?search=keyword)
  if (req.query.search) {
    const searchTerm = req.query.search.toLowerCase();
    result = result.filter(t => t.title.toLowerCase().includes(searchTerm));
  }

  res.status(200).json(result);
});

// Extra: Statistics endpoint (GET /stats)
app.get('/stats', (req, res) => {
  const total = tasks.length;
  const doneCount = tasks.filter(t => t.done).length;
  const openCount = total - doneCount;

  res.status(200).json({
    total,
    done: doneCount,
    open: openCount
  });
});

// Extra: Seed & Reset endpoint (POST /reset)
app.post('/reset', (req, res) => {
  tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
  nextId = 4;
  res.status(200).json({ message: "Tasks dataset reset to default state", tasks });
});

// Stage 2: Read single task by ID
app.get('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const task = tasks.find(t => t.id === id);

  if (!task) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }

  res.status(200).json(task);
});

// Stage 3: Create task with validation
app.post('/tasks', (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: "Title is required and must be a non-empty string" });
  }

  const newTask = {
    id: nextId++,
    title: title.trim(),
    done: false
  };

  tasks.push(newTask);
  res.status(201).json(newTask);
});

// Stage 4: Update task by ID
app.put('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const taskIndex = tasks.findIndex(t => t.id === id);

  if (taskIndex === -1) {
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

  if (title !== undefined) {
    tasks[taskIndex].title = title.trim();
  }

  if (done !== undefined) {
    tasks[taskIndex].done = done;
  }

  res.status(200).json(tasks[taskIndex]);
});

// Stage 4: Delete task by ID
app.delete('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const taskIndex = tasks.findIndex(t => t.id === id);

  if (taskIndex === -1) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }

  tasks.splice(taskIndex, 1);
  res.status(204).send();
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Swagger UI documentation available at http://localhost:${PORT}/docs`);
  });
}

module.exports = app;
