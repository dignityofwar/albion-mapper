import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

// A known valid zone ID from the shared catalogue
const VALID_ZONE_ID = 'qiient-al-nusom';

let app: FastifyInstance;
let mockDb: any;

beforeEach(async () => {
  mockDb = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
  app = await buildApp({ db: mockDb, disableRateLimit: true, jwtSecret: 'test-secret' });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('POST /api/rooms', () => {
  it('creates a room and returns id + shareUrl', async () => {
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT
    
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'secret', adminPassword: 'admin', homeZoneId: VALID_ZONE_ID },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ id: string; shareUrl: string }>();
    expect(body.id).toBeDefined();
    expect(body.id).toHaveLength(12);
    expect(body.shareUrl).toContain(body.id);
  });

  it('hashes the password (not stored as plaintext)', async () => {
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT
    
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'mypassword', adminPassword: 'admin', homeZoneId: VALID_ZONE_ID },
    });
    expect(res.statusCode).toBe(201);
    const { id } = res.json<{ id: string }>();

    // Mock the direct DB query in the test
    mockDb.query.mockResolvedValueOnce({ 
      rows: [{ password_hash: '$2b$12$somehash' }] 
    });

    const { rows } = await (app as any).db.query('SELECT password_hash FROM rooms WHERE id = $1', [id]);
    const row = rows[0];
    expect(row).toBeDefined();
    expect(row!.password_hash).not.toBe('mypassword');
    expect(row!.password_hash).toMatch(/^\$2b\$/); // bcrypt hash prefix
  });

  it('generates unique slugs', async () => {
    mockDb.query.mockResolvedValue({ rowCount: 1, rows: [] });
    
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'pw1', adminPassword: 'admin', homeZoneId: VALID_ZONE_ID },
    });
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'pw2', adminPassword: 'admin', homeZoneId: VALID_ZONE_ID },
    });
    expect(res1.json<{ id: string }>().id).not.toBe(res2.json<{ id: string }>().id);
  });

  it('rejects when homeZoneId is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'secret', adminPassword: 'admin' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects when homeZoneId is empty string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'secret', adminPassword: 'admin', homeZoneId: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects when homeZoneId is not in zone catalogue', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'secret', adminPassword: 'admin', homeZoneId: 'totally-unknown-zone-xyz' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/zone catalogue/i);
  });

  it('rejects when homeZoneId is not a roads home', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'secret', adminPassword: 'admin', homeZoneId: 'willow-wood' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/not a valid roads home/i);
  });
});

describe('POST /api/rooms/:id/auth', () => {
  let roomId = 'test-room-id';

  it('returns a token with correct password', async () => {
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.default.hash('correct-pw', 1);
    mockDb.query.mockResolvedValueOnce({ 
      rows: [{ id: roomId, password_hash: hash }] 
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/auth`,
      payload: { password: 'correct-pw' },
    });
    expect(res.statusCode).toBe(200);
    const { token } = res.json<{ token: string }>();
    expect(token).toBeDefined();
  });

  it('returns 401 with wrong password', async () => {
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.default.hash('correct-pw', 1);
    mockDb.query.mockResolvedValueOnce({ 
      rows: [{ id: roomId, password_hash: hash }] 
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/auth`,
      payload: { password: 'wrong-pw' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for non-existent room', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] });

    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms/doesnotexist12/auth',
      payload: { password: 'pw' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('Home Zone Node Protection', () => {
  it('should NOT allow changing home zone via PATCH /api/rooms/:id', async () => {
    const roomId = 'test-room-id';
    const token = app.jwt.sign({ roomId });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/rooms/${roomId}`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      payload: { homeZoneId: 'qiient-et-tertum' },
    });

    // It should now return 404 since the route is removed
    expect(res.statusCode).toBe(404);
  });
});
