import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let mockDb: any;

beforeEach(async () => {
  mockDb = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    }),
  };
  app = await buildApp({ db: mockDb, disableRateLimit: true, jwtSecret: 'test-secret' });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

it('should allow PATCH using vanity URL as room ID directly (no resolution needed)', async () => {
  const roomId = 'link-test'; // vanity URL IS the room ID
  const token = app.jwt.sign({ roomId });

  mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room existence check
  mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'conn-id' }] }); // connection existence check
  mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE
  mockDb.query.mockResolvedValueOnce({ rows: [{
    id: 'conn-id', room_id: roomId, from_zone_id: 'qiient-al-nusom', to_zone_id: 'qiient-al-odesum',
    from_handle_id: 'e', to_handle_id: 'c-p2',
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    reported_at: new Date().toISOString(), reported_by: null
  }] }); // SELECT updated

  const res = await app.inject({
    method: 'PATCH',
    url: `/api/rooms/${roomId}/connections/conn-id`,
    headers: { authorization: `Bearer ${token}` },
    payload: { fromHandleId: 'e', toHandleId: 'c-p2' },
  });

  expect(res.statusCode).toBe(200);
});
