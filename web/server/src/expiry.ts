import { Pool } from 'pg';
import { broadcast } from './broadcast.js';

const STALE_GRACE_MS = 6 * 60 * 60 * 1000; // 6 hours

interface ExpiredRow {
  id: string;
  room_id: string;
}

export function startExpiryCleanup(db: Pool): NodeJS.Timeout {
  return setInterval(() => {
    runExpiryCleanup(db).catch(console.error);
  }, 60_000);
}

export async function runExpiryCleanup(db: Pool): Promise<void> {
  const now = new Date();
  
  // 1. Notify for connections that expired since the last check
  const lastCheck = new Date(now.getTime() - 61_000).toISOString();
  const currentNow = now.toISOString();

  const { rows: newlyExpired } = await db.query<ExpiredRow>(
    'SELECT id, room_id FROM connections WHERE expires_at <= $1 AND expires_at > $2',
    [currentNow, lastCheck]
  );

  for (const row of newlyExpired) {
    broadcast(row.room_id, { type: 'connection_expired', connectionId: row.id });
  }

  // 2. Cleanup (delete) connections that are past STALE_GRACE_MS
  const cutoff = new Date(now.getTime() - STALE_GRACE_MS).toISOString();

  const { rows: expired } = await db.query<ExpiredRow>(
    'SELECT id, room_id FROM connections WHERE expires_at <= $1',
    [cutoff]
  );

  if (expired.length === 0) return;

  const ids = expired.map((r) => r.id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  await db.query(`DELETE FROM connections WHERE id IN (${placeholders})`, ids);

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
