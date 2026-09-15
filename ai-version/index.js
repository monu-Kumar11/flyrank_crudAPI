const express = require('express');
const app = express();
app.use(express.json());

// AI generated in-memory tasks array
let tasks = [
  { id: 1, title: "Task 1", done: false },
  { id: 2, title: "Task 2", done: false },
  { id: 3, title: "Task 3", done: false }
];

app.get('/tasks', (req, res) => {
  res.json(tasks);
});

app.get('/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id == req.params.id);
  if (!task) return res.status(404).send('Not found');
  res.json(task);
});

app.post('/tasks', (req, res) => {
  if (!req.body.title) return res.status(400).send('Title required');
  const task = { id: tasks.length + 1, title: req.body.title, done: false };
  tasks.push(task);
  res.status(201).json(task);
});

app.put('/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id == req.params.id);
  if (!task) return res.status(404).send('Not found');
  if (req.body.title) task.title = req.body.title;
  if (req.body.done !== undefined) task.done = req.body.done;
  res.json(task);
});

app.delete('/tasks/:id', (req, res) => {
  tasks = tasks.filter(t => t.id != req.params.id);
  res.status(204).send();
});

app.listen(3000, () => console.log('AI server running on port 3000'));
