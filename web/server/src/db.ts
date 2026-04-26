import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      admin_password_hash TEXT NOT NULL,
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

    CREATE TABLE IF NOT EXISTS room_node_positions (
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      zone_id TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      PRIMARY KEY (room_id, zone_id)
    );

    CREATE INDEX IF NOT EXISTS idx_conn_room ON connections(room_id);
    CREATE INDEX IF NOT EXISTS idx_node_positions_room ON room_node_positions(room_id);
  `);
}

export { pool as db };
