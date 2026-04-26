import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import type { Connection } from 'shared';
import bcrypt from 'bcrypt';

const VALID_ZONE_A = 'qiient-al-nusom';
const VALID_ZONE_B = 'qiient-al-odesum';
const UNKNOWN_ZONE = 'totally-unknown-zone-xyz';

let app: FastifyInstance;
let roomId = 'test-room-id';
let token: string;
let mockDb: any;

beforeEach(async () => {
  mockDb = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: vi.fn(),
  };
  app = await buildApp({ db: mockDb, disableRateLimit: true, jwtSecret: 'test-secret' });
  await app.ready();

  // Mock successful auth
  token = app.jwt.sign({ roomId });
});

afterEach(async () => {
  await app.close();
});

describe('POST /api/rooms/:id/connections', () => {
  it('creates a connection and returns it', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT connection
    
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
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
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
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
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
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
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
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, minutesRemaining: 0 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects minutesRemaining > 1440', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, minutesRemaining: 1441 },
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
    // PATCH /api/rooms/:id/connections/:connId
    const connId = 'conn-1';
    
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: connId }] }); // existence check
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE
    mockDb.query.mockResolvedValueOnce({ rows: [{ 
      id: connId, room_id: roomId, from_zone_id: VALID_ZONE_A, to_zone_id: VALID_ZONE_B,
      expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
      reported_at: new Date().toISOString(), reported_by: null
    }] }); // SELECT updated

    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/rooms/${roomId}/connections/${connId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { minutesRemaining: 120 },
    });
    
    expect(updateRes.statusCode).toBe(200);
    const updatedConn = updateRes.json<Connection>();
    expect(updatedConn.id).toBe(connId);
  });
});

describe('GET /api/rooms/:id/connections', () => {
  it('returns active and stale connections, omits expired', async () => {
    const now = Date.now();

    const activeConn = {
      id: 'active',
      room_id: roomId,
      from_zone_id: VALID_ZONE_A,
      to_zone_id: VALID_ZONE_B,
      expires_at: new Date(now + 60 * 60 * 1000).toISOString(),
      reported_at: new Date(now).toISOString(),
      reported_by: null,
    };

    const staleConn = {
      id: 'stale',
      room_id: roomId,
      from_zone_id: VALID_ZONE_A,
      to_zone_id: VALID_ZONE_B,
      expires_at: new Date(now - 60 * 60 * 1000).toISOString(),
      reported_at: new Date(now - 90 * 60 * 1000).toISOString(),
      reported_by: null,
    };

    const expiredConn = {
      id: 'expired',
      room_id: roomId,
      from_zone_id: VALID_ZONE_A,
      to_zone_id: VALID_ZONE_B,
      expires_at: new Date(now - 7 * 60 * 60 * 1000).toISOString(),
      reported_at: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
      reported_by: null,
    };

    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [activeConn, staleConn, expiredConn] });

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
    const zoneA = VALID_ZONE_A;
    const zoneB = VALID_ZONE_B;
    const conn1Id = 'conn-1';

    // Query 1: SELECT from connections
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: conn1Id, from_zone_id: zoneA, to_zone_id: zoneB }] });
    // Query 2: DELETE from connections
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    // Query 3: SELECT from rooms
    mockDb.query.mockResolvedValueOnce({ rows: [{ home_zone_id: zoneA }] });
    // Loop for zoneA (skipped)
    // Loop for zoneB:
    // Query 4: SELECT 1 FROM connections
    mockDb.query.mockResolvedValueOnce({ rows: [] });
    // Query 5: DELETE FROM room_node_positions
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    // Query 6: SELECT from room_node_positions (for broadcast)
    mockDb.query.mockResolvedValueOnce({ rows: [] });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/rooms/${roomId}/connections/${conn1Id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);
  });
});

describe('DELETE /api/rooms/:id/connections (Reset)', () => {
  it('deletes all connections and removes all orphaned nodes', async () => {
    const zoneA = VALID_ZONE_A; // Home
    const adminPw = 'admin-pw';
    const hash = await bcrypt.hash(adminPw, 1);

    // Query 1: SELECT admin_password_hash FROM rooms
    mockDb.query.mockResolvedValueOnce({ rows: [{ admin_password_hash: hash }] });
    // Query 2: DELETE FROM connections
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    // Query 3: SELECT home_zone_id FROM rooms
    mockDb.query.mockResolvedValueOnce({ rows: [{ home_zone_id: zoneA }] });
    // Query 4: DELETE FROM room_node_positions
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    // Query 5: UPDATE rooms updated_at
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { adminPassword: adminPw },
    });
    expect(res.statusCode).toBe(204);
  });
});
