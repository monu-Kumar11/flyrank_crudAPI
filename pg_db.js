require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:dev@localhost:5432/tasks';

const pool = new Pool({
  connectionString: connectionString,
  connectionTimeoutMillis: 5000,
});

async function initDb() {
  try {
    const client = await pool.connect();
    try {
      // Create table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          done BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Seed 3 tasks ONLY if table is empty
      const countRes = await client.query('SELECT COUNT(*)::int AS count FROM tasks;');
      if (countRes.rows[0].count === 0) {
        await client.query(`
          INSERT INTO tasks (title, done) VALUES 
          ('Learn Express basics', true),
          ('Build CRUD API endpoints', false),
          ('Test API with Swagger UI', false);
        `);
        console.log('PostgreSQL database initialized and seeded with 3 tasks.');
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('PostgreSQL connection attempt pending or container initializing:', err.message);
  }
}

// Trigger initial database setup
initDb();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initDb
};
