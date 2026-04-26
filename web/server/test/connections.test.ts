import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { createInMemoryDb } from '../src/db.js';
import type { FastifyInstance } from 'fastify';
import type { Connection } from 'shared';

const VALID_ZONE_A = 'adrens-hill';
const VALID_ZONE_B = 'anklesnag-mire';
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
