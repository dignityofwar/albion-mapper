import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { UpdateConnectionBodySchema } from 'shared';

describe('PATCH /api/rooms/:id/connections/:connId validation', () => {
  it('UpdateConnectionBodySchema behavior with null', () => {
    const result = UpdateConnectionBodySchema.safeParse({ fromHandleId: null });
    expect(result.success).toBe(true);
    expect(result.data?.fromHandleId).toBe(null);
  });

  it('UpdateConnectionBodySchema behavior with empty object', () => {
    const result = UpdateConnectionBodySchema.safeParse({});
    if (!result.success) {
      console.log('UpdateConnectionBodySchema error with {}:', result.error.issues);
    }
    expect(result.success).toBe(true);
  });

  it('UpdateConnectionBodySchema behavior with undefined', () => {
    const result = UpdateConnectionBodySchema.safeParse(undefined);
    expect(result.success).toBe(false);
    // @ts-ignore
    expect(result.error.issues[0].message).toBe('Required');
  });
});

describe('Fastify PATCH behavior', () => {
  let app: FastifyInstance;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      connect: vi.fn(),
    };
    app = await buildApp({ db: mockDb, disableRateLimit: true, jwtSecret: 'test-secret' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns Required if body is empty', async () => {
    const roomId = 'test-room';
    const connId = 'test-conn';
    const token = app.jwt.sign({ roomId });

    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room existence check

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/rooms/${roomId}/connections/${connId}`,
      headers: { 
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      // No payload
    });

    expect(res.statusCode).toBe(400);
  });
  
  it('returns 404 if connection not found when fromHandleId is null (schema accepts null)', async () => {
    const roomId = 'test-room';
    const connId = 'test-conn';
    const token = app.jwt.sign({ roomId });

    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room existence check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connection not found

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/rooms/${roomId}/connections/${connId}`,
      headers: { 
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      payload: { fromHandleId: null }
    });

    // null is valid per schema; route proceeds to connection lookup which returns 404
    expect(res.statusCode).toBe(404);
  });
});
