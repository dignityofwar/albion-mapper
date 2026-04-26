import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

let dbInstance: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
  if (dbInstance) return dbInstance;

  const resolvedPath = dbPath ?? path.resolve(process.cwd(), 'data', 'roads.db');
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  dbInstance = new Database(resolvedPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      home_zone_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      from_zone_id TEXT NOT NULL,
      to_zone_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      reported_at TEXT NOT NULL,
      reported_by TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_conn_room ON connections(room_id);
  `);

  return dbInstance;
}

export function resetDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function createInMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      home_zone_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      from_zone_id TEXT NOT NULL,
      to_zone_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      reported_at TEXT NOT NULL,
      reported_by TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_conn_room ON connections(room_id);
  `);

  return db;
}
