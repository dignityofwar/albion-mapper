import 'dotenv/config';
import pkg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { runner } from 'node-pg-migrate';

const { Pool } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: typeof process !== 'undefined' ? process.env?.DATABASE_URL : undefined,
});

export async function initDb() {
  const databaseUrl = typeof process !== 'undefined' ? process.env?.DATABASE_URL : undefined;
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
