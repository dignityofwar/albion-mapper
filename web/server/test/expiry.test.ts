import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInMemoryDb } from '../src/db.js';
import { runExpiryCleanup } from '../src/expiry.js';
import { broadcast } from '../src/broadcast.js';
import type Database from 'better-sqlite3';

vi.mock('../src/broadcast.js', () => ({
  broadcast: vi.fn(),
}));

const ROOM_ID = 'test-room-001';
const ZONE_A = 'adrens-hill';
const ZONE_B = 'anklesnag-mire';

let db: Database.Database;

function insertRoom(id: string) {
  db.prepare(
    'INSERT INTO rooms (id, password_hash, home_zone_id, created_at) VALUES (?, ?, ?, ?)',
  ).run(id, '$2b$12$fakehash', ZONE_A, new Date().toISOString());
}

function insertConnection(
  id: string,
  expiresAt: Date,
  reportedAt: Date = new Date(),
) {
  db.prepare(
    'INSERT INTO connections (id, room_id, from_zone_id, to_zone_id, expires_at, reported_at, reported_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, ROOM_ID, ZONE_A, ZONE_B, expiresAt.toISOString(), reportedAt.toISOString(), null);
}

function connectionExists(id: string): boolean {
  return !!db.prepare('SELECT id FROM connections WHERE id = ?').get(id);
}

beforeEach(() => {
  db = createInMemoryDb();
  insertRoom(ROOM_ID);
  vi.clearAllMocks();
});

describe('runExpiryCleanup', () => {
  it('a connection becomes stale at expiresAt but is NOT deleted yet (within 6h)', () => {
    const now = new Date();
    const connId = crypto.randomUUID();

    // Expired 1 minute ago — stale, not yet past the 6h grace window
    const expiresAt = new Date(now.getTime() - 60 * 1000);
    insertConnection(connId, expiresAt);

    runExpiryCleanup(db);

    // Still exists because it's within the 6h stale window
    expect(connectionExists(connId)).toBe(true);
  });

  it('removes a connection when expiresAt + 6h has passed', () => {
    const now = new Date();
    const connId = crypto.randomUUID();

    // Expired 7 hours ago — past the 6h grace, should be deleted
    const expiresAt = new Date(now.getTime() - 7 * 60 * 60 * 1000);
    insertConnection(connId, expiresAt);

    runExpiryCleanup(db);

    expect(connectionExists(connId)).toBe(false);
  });

  it('broadcasts connection_removed for each deleted connection', () => {
    const now = new Date();
    const connId = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() - 7 * 60 * 60 * 1000);
    insertConnection(connId, expiresAt);

    runExpiryCleanup(db);

    expect(connectionExists(connId)).toBe(false);
    expect(broadcast).toHaveBeenCalledWith(ROOM_ID, expect.objectContaining({ type: 'connection_removed', connectionId: connId }));
  });

  it('broadcasts connection_expired immediately upon expiry', () => {
    const now = new Date();
    const connId = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() - 60 * 1000);
    insertConnection(connId, expiresAt);

    runExpiryCleanup(db);

    expect(broadcast).toHaveBeenCalledWith(ROOM_ID, expect.objectContaining({ type: 'connection_expired', connectionId: connId }));
    expect(connectionExists(connId)).toBe(true);
  });

  it('keeps active connections untouched', () => {
    const now = new Date();
    const connId = crypto.randomUUID();

    // Expires in 2 hours — active
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    insertConnection(connId, expiresAt);

    runExpiryCleanup(db);

    expect(connectionExists(connId)).toBe(true);
  });

  it('handles empty connections table without error', () => {
    expect(() => runExpiryCleanup(db)).not.toThrow();
  });
});
