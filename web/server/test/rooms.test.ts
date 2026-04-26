import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { createInMemoryDb } from '../src/db.js';
import type { FastifyInstance } from 'fastify';

// A known valid zone ID from the shared catalogue
const VALID_ZONE_ID = 'qiient-al-nusom';

let app: FastifyInstance;

beforeEach(async () => {
  const db = createInMemoryDb();
  app = await buildApp({ db, disableRateLimit: true, jwtSecret: 'test-secret' });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('POST /api/rooms', () => {
  it('creates a room and returns id + shareUrl', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'secret', homeZoneId: VALID_ZONE_ID },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ id: string; shareUrl: string }>();
    expect(body.id).toBeDefined();
    expect(body.id).toHaveLength(12);
    expect(body.shareUrl).toContain(body.id);
  });

  it('hashes the password (not stored as plaintext)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'mypassword', homeZoneId: VALID_ZONE_ID },
    });
    expect(res.statusCode).toBe(201);
    const { id } = res.json<{ id: string }>();

    // Query the DB directly via the app's db decoration
    const row = (app as unknown as { db: { prepare: (s: string) => { get: (id: string) => { password_hash: string } | undefined } } })
      .db.prepare('SELECT password_hash FROM rooms WHERE id = ?').get(id);
    expect(row).toBeDefined();
    expect(row!.password_hash).not.toBe('mypassword');
    expect(row!.password_hash).toMatch(/^\$2b\$/); // bcrypt hash prefix
  });

  it('generates unique slugs', async () => {
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'pw1', homeZoneId: VALID_ZONE_ID },
    });
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'pw2', homeZoneId: VALID_ZONE_ID },
    });
    expect(res1.json<{ id: string }>().id).not.toBe(res2.json<{ id: string }>().id);
  });

  it('rejects when homeZoneId is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'secret' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects when homeZoneId is empty string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'secret', homeZoneId: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects when homeZoneId is not in zone catalogue', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'secret', homeZoneId: 'totally-unknown-zone-xyz' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/zone catalogue/i);
  });

  it('rejects when homeZoneId is not a roads home', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'secret', homeZoneId: 'willow-wood' },
    });
    // This should fail if we want to restrict it
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/not a valid roads home/i);
  });
});

describe('POST /api/rooms/:id/auth', () => {
  let roomId: string;

  beforeEach(async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'correct-pw', homeZoneId: VALID_ZONE_ID },
    });
    roomId = res.json<{ id: string }>().id;
  });

  it('returns a token with correct password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/auth`,
      payload: { password: 'correct-pw' },
    });
    expect(res.statusCode).toBe(200);
    const { token } = res.json<{ token: string }>();
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  it('returns 401 with wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/auth`,
      payload: { password: 'wrong-pw' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for non-existent room', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms/doesnotexist12/auth',
      payload: { password: 'pw' },
    });
    expect(res.statusCode).toBe(404);
  });
});
