import type Database from 'better-sqlite3';
import { broadcast } from './broadcast.js';

const STALE_GRACE_MS = 6 * 60 * 60 * 1000; // 6 hours

interface ExpiredRow {
  id: string;
  room_id: string;
}

export function startExpiryCleanup(db: Database.Database): NodeJS.Timeout {
  return setInterval(() => {
    runExpiryCleanup(db);
  }, 60_000);
}

export function runExpiryCleanup(db: Database.Database): void {
  const now = new Date();
  
  // 1. Notify for connections that expired since the last check
  const lastCheck = new Date(now.getTime() - 61_000).toISOString();
  const currentNow = now.toISOString();

  const newlyExpired = db
    .prepare('SELECT id, room_id FROM connections WHERE expires_at <= ? AND expires_at > ?')
    .all(currentNow, lastCheck) as ExpiredRow[];

  for (const row of newlyExpired) {
    broadcast(row.room_id, { type: 'connection_expired', connectionId: row.id });
  }

  // 2. Cleanup (delete) connections that are past STALE_GRACE_MS
  const cutoff = new Date(now.getTime() - STALE_GRACE_MS).toISOString();

  const expired = db
    .prepare('SELECT id, room_id FROM connections WHERE expires_at <= ?')
    .all(cutoff) as ExpiredRow[];

  if (expired.length === 0) return;

  const ids = expired.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM connections WHERE id IN (${placeholders})`).run(...ids);

  // Broadcast removal per room for deleted connections
  const byRoom = new Map<string, string[]>();
  for (const row of expired) {
    if (!byRoom.has(row.room_id)) byRoom.set(row.room_id, []);
    byRoom.get(row.room_id)!.push(row.id);
  }

  for (const [roomId, connIds] of byRoom) {
    for (const connId of connIds) {
      broadcast(roomId, { type: 'connection_removed', connectionId: connId });
    }
  }
}
