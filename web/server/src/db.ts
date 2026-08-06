import 'dotenv/config';
import pkg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { runner } from 'node-pg-migrate';
import { instrumentPool } from './db_incidents.js';

const { Pool } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Timeouts are the backstop against one stuck transaction taking the whole API
// down: without them a stranded connection holds its pool slot forever, and once
// all `max` slots are gone every pooled query — /api/health included — waits
// indefinitely rather than failing.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  statement_timeout: 30_000,
  idle_in_transaction_session_timeout: 30_000,
});

instrumentPool(pool);

pool.on('error', (err) => {
  console.error('pg pool error on idle client:', err.message);
});

export async function initDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const migrationsDir = path.join(__dirname, '../migrations');

  console.log('Running migrations...');
  await runner({
    databaseUrl,
    dir: migrationsDir,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    verbose: true,
  });
  console.log('Migrations completed');
}

export { pool as db };
