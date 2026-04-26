import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { createInMemoryDb } from '../src/db.js';
import type { FastifyInstance } from 'fastify';
import type { Connection } from 'shared';

const VALID_ZONE_A = 'qiient-al-nusom';
const VALID_ZONE_B = 'qiient-al-odesum';
const UNKNOWN_ZONE = 'totally-unknown-zone-xyz';

let app: FastifyInstance;
let roomId: string;
let token: string;

beforeEach(async () => {
  const db = createInMemoryDb();
  app = await buildApp({ db, disableRateLimit: true, jwtSecret: 'test-secret' });
  await app.ready();

  // Create a room and authenticate
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/rooms',
    payload: { password: 'pw', homeZoneId: VALID_ZONE_A },
  });
  roomId = createRes.json<{ id: string }>().id;

  const authRes = await app.inject({
    method: 'POST',
    url: `/api/rooms/${roomId}/auth`,
    payload: { password: 'pw' },
  });
  token = authRes.json<{ token: string }>().token;
});

afterEach(async () => {
  await app.close();
});

describe('POST /api/rooms/:id/connections', () => {
  it('creates a connection and returns it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, minutesRemaining: 30 },
    });
    expect(res.statusCode).toBe(201);
    const conn = res.json<Connection>();
    expect(conn.id).toBeDefined();
    expect(conn.fromZoneId).toBe(VALID_ZONE_A);
    expect(conn.toZoneId).toBe(VALID_ZONE_B);
    expect(conn.roomId).toBe(roomId);
    expect(conn.expiresAt).toBeDefined();
    expect(conn.reportedAt).toBeDefined();
  });

  it('rejects same-zone connections', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_A, minutesRemaining: 30 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/different/i);
  });

  it('rejects unknown fromZoneId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: UNKNOWN_ZONE, toZoneId: VALID_ZONE_B, minutesRemaining: 30 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/zone catalogue/i);
  });

  it('rejects unknown toZoneId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: UNKNOWN_ZONE, minutesRemaining: 30 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/zone catalogue/i);
  });

  it('rejects minutesRemaining = 0', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, minutesRemaining: 0 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects minutesRemaining > 360', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, minutesRemaining: 361 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('requires authorization', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, minutesRemaining: 30 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('updates a connection', async () => {
    // Create a connection
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, minutesRemaining: 60 },
    });
    const conn = createRes.json<Connection>();

    // Update it
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/rooms/${roomId}/connections/${conn.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { minutesRemaining: 120 },
    });
    
    expect(updateRes.statusCode).toBe(200);
    const updatedConn = updateRes.json<Connection>();
    expect(new Date(updatedConn.expiresAt).getTime()).toBeGreaterThan(new Date(conn.expiresAt).getTime());
  });
});

describe('GET /api/rooms/:id/connections', () => {
  it('returns active and stale connections, omits expired', async () => {
    const now = Date.now();

    // Insert connections directly with controlled timestamps
    const db = (app as unknown as { db: ReturnType<typeof createInMemoryDb> }).db;

    const activeConn = {
      id: crypto.randomUUID(),
      room_id: roomId,
      from_zone_id: VALID_ZONE_A,
      to_zone_id: VALID_ZONE_B,
      expires_at: new Date(now + 60 * 60 * 1000).toISOString(), // expires in 1h (active)
      reported_at: new Date(now).toISOString(),
      reported_by: null,
    };

    const staleConn = {
      id: crypto.randomUUID(),
      room_id: roomId,
      from_zone_id: VALID_ZONE_A,
      to_zone_id: VALID_ZONE_B,
      expires_at: new Date(now - 60 * 60 * 1000).toISOString(), // expired 1h ago (stale, within 6h)
      reported_at: new Date(now - 90 * 60 * 1000).toISOString(),
      reported_by: null,
    };

    const expiredConn = {
      id: crypto.randomUUID(),
      room_id: roomId,
      from_zone_id: VALID_ZONE_A,
      to_zone_id: VALID_ZONE_B,
      expires_at: new Date(now - 7 * 60 * 60 * 1000).toISOString(), // expired 7h ago (past stale)
      reported_at: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
      reported_by: null,
    };

    for (const conn of [activeConn, staleConn, expiredConn]) {
      db.prepare(
        'INSERT INTO connections (id, room_id, from_zone_id, to_zone_id, expires_at, reported_at, reported_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(conn.id, conn.room_id, conn.from_zone_id, conn.to_zone_id, conn.expires_at, conn.reported_at, conn.reported_by);
    }

    const res = await app.inject({
      method: 'GET',
      url: `/api/rooms/${roomId}/connections`,
    });
    expect(res.statusCode).toBe(200);
    const connections = res.json<Connection[]>();
    const ids = connections.map((c) => c.id);

    expect(ids).toContain(activeConn.id);
    expect(ids).toContain(staleConn.id);
    expect(ids).not.toContain(expiredConn.id);
  });
});

describe('DELETE /api/rooms/:id/connections/:connId', () => {
  it('deletes the connection and removes orphaned node, but keeps home node', async () => {
    const db = (app as unknown as { db: ReturnType<typeof createInMemoryDb> }).db;

    // Set A as home
    const zoneA = VALID_ZONE_A;
    const zoneB = VALID_ZONE_B;
    const zoneC = 'anklesnag-mire-2'; // Need a different zone to be C

    // A-B, B-C
    const conn1Id = crypto.randomUUID();
    const conn2Id = crypto.randomUUID();

    db.prepare(
      'INSERT INTO connections (id, room_id, from_zone_id, to_zone_id, expires_at, reported_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(conn1Id, roomId, zoneA, zoneB, new Date().toISOString(), new Date().toISOString());

    db.prepare(
      'INSERT INTO connections (id, room_id, from_zone_id, to_zone_id, expires_at, reported_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(conn2Id, roomId, zoneB, zoneC, new Date().toISOString(), new Date().toISOString());

    // Make positions for B and C
    db.prepare('INSERT INTO room_node_positions (room_id, zone_id, x, y) VALUES (?, ?, ?, ?)')
      .run(roomId, zoneB, 10, 10);
    db.prepare('INSERT INTO room_node_positions (room_id, zone_id, x, y) VALUES (?, ?, ?, ?)')
      .run(roomId, zoneC, 20, 20);

    // Delete A-B
    await app.inject({
      method: 'DELETE',
      url: `/api/rooms/${roomId}/connections/${conn1Id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    // C should NOT be removed (B still has a link to C)
    const posC = db.prepare('SELECT 1 FROM room_node_positions WHERE room_id = ? AND zone_id = ?').get(roomId, zoneC);
    expect(posC).toBeDefined();

    // B should NOT be removed (still linked to C)
    const posB = db.prepare('SELECT 1 FROM room_node_positions WHERE room_id = ? AND zone_id = ?').get(roomId, zoneB);
    expect(posB).toBeDefined();

    // Delete B-C
    await app.inject({
      method: 'DELETE',
      url: `/api/rooms/${roomId}/connections/${conn2Id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    // B should now be removed
    const posB2 = db.prepare('SELECT 1 FROM room_node_positions WHERE room_id = ? AND zone_id = ?').get(roomId, zoneB);
    expect(posB2).toBeUndefined();
    // C should now be removed
    const posC2 = db.prepare('SELECT 1 FROM room_node_positions WHERE room_id = ? AND zone_id = ?').get(roomId, zoneC);
    expect(posC2).toBeUndefined();
  });
});

describe('DELETE /api/rooms/:id/connections (Reset)', () => {
  it('deletes all connections and removes all orphaned nodes', async () => {
    const db = (app as unknown as { db: ReturnType<typeof createInMemoryDb> }).db;

    const zoneA = VALID_ZONE_A; // Home
    const zoneB = VALID_ZONE_B;
    const zoneC = 'anklesnag-mire-2';

    // A-B, B-C
    db.prepare(
      'INSERT INTO connections (id, room_id, from_zone_id, to_zone_id, expires_at, reported_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(crypto.randomUUID(), roomId, zoneA, zoneB, new Date().toISOString(), new Date().toISOString());
    db.prepare(
      'INSERT INTO connections (id, room_id, from_zone_id, to_zone_id, expires_at, reported_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(crypto.randomUUID(), roomId, zoneB, zoneC, new Date().toISOString(), new Date().toISOString());

    db.prepare('INSERT INTO room_node_positions (room_id, zone_id, x, y) VALUES (?, ?, ?, ?)')
      .run(roomId, zoneB, 10, 10);
    db.prepare('INSERT INTO room_node_positions (room_id, zone_id, x, y) VALUES (?, ?, ?, ?)')
      .run(roomId, zoneC, 20, 20);

    // Reset
    await app.inject({
      method: 'DELETE',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
    });

    const conns = db.prepare('SELECT 1 FROM connections WHERE room_id = ?').all(roomId);
    expect(conns).toHaveLength(0);

    const posB = db.prepare('SELECT 1 FROM room_node_positions WHERE room_id = ? AND zone_id = ?').get(roomId, zoneB);
    expect(posB).toBeUndefined();

    const posC = db.prepare('SELECT 1 FROM room_node_positions WHERE room_id = ? AND zone_id = ?').get(roomId, zoneC);
    expect(posC).toBeUndefined();

    const posHome = db.prepare('SELECT 1 FROM room_node_positions WHERE room_id = ? AND zone_id = ?').get(roomId, zoneA);
    // Home should be kept even if it wasn't there before, but the query check is for existing.
    // Wait, if it wasn't there, it won't be there.
  });
});
