import 'dotenv/config';
import pkg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { runner } from 'node-pg-migrate';
import { recordDbIncident } from './db_incidents.js';

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

// Count discarded transactions at the pool, so no call site can swallow one.
// Patching the checked-out client too: a transaction killed by a timeout only
// surfaces on the *next* query issued on that client, not at the pool level.
function watch<T>(result: Promise<T>): Promise<T> {
  return result.catch((err: unknown) => {
    recordDbIncident(err);
    throw err;
  });
}

const poolQuery = pool.query.bind(pool);
pool.query = ((...args: unknown[]) => {
  const result = (poolQuery as (...a: unknown[]) => unknown)(...args);
  return result instanceof Promise ? watch(result) : result;
}) as typeof pool.query;

const poolConnect = pool.connect.bind(pool);
pool.connect = (async (...args: unknown[]) => {
  const client = await watch((poolConnect as (...a: unknown[]) => Promise<any>)(...args));
  if (!client.__incidentsWatched) {
    const clientQuery = client.query.bind(client);
    client.query = (...qArgs: unknown[]) => {
      const result = clientQuery(...qArgs);
      return result instanceof Promise ? watch(result) : result;
    };
    client.__incidentsWatched = true;
  }
  return client;
}) as typeof pool.connect;

// Errors on connections sitting idle in the pool are emitted here, not thrown.
pool.on('error', (err) => {
  recordDbIncident(err);
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
