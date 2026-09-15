const Database = require('better-sqlite3');
const path = require('path');

// Open or create database file named tasks.db in project root
const dbPath = path.join(__dirname, 'tasks.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency performance
db.pragma('journal_mode = WAL');

// Stage 0: Create tasks table if it does not exist
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;
db.exec(createTableQuery);

// Seed initial 3 tasks ONLY if table is empty
const rowCount = db.prepare('SELECT COUNT(*) AS count FROM tasks').get();

if (rowCount.count === 0) {
  const insertStmt = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  const seedTransaction = db.transaction((seedItems) => {
    for (const item of seedItems) {
      insertStmt.run(item.title, item.done);
    }
  });

  seedTransaction([
    { title: 'Learn Express basics', done: 1 },
    { title: 'Build CRUD API endpoints', done: 0 },
    { title: 'Test API with Swagger UI', done: 0 }
  ]);
  console.log('Database initialized and seeded with 3 example tasks.');
}

module.exports = db;
