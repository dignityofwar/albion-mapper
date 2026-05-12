import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

// A known valid zone ID from the shared catalogue
const VALID_ZONE_ID = 'qiient-al-nusom'; 

describe('PUT /api/rooms/:id/import', () => {
  let app: FastifyInstance;
  let mockDb: any;
  let clientMock: any;

  beforeEach(async () => {
    clientMock = {
      query: vi.fn().mockResolvedValue({ rowCount: 1 }),
      release: vi.fn(),
    };
    mockDb = {
      query: vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT')) {
           return Promise.resolve({ rows: [{ id: 'test-room', admin_password_hash: 'hash', home_zone_id: VALID_ZONE_ID }], rowCount: 1 });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      }),
      connect: vi.fn().mockResolvedValue(clientMock),
    };
    app = await buildApp({ db: mockDb, disableRateLimit: true, jwtSecret: 'test-secret' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('persists explored status when importing node positions', async () => {
    const roomId = 'test-room';
    const token = app.jwt.sign({ roomId });

    const importPayload = {
      homeZoneId: VALID_ZONE_ID,
      connections: [],
      nodePositions: [
        {
          zoneId: 'zone1',
          x: 10,
          y: 20,
          explored: true,
          features: {},
          customHandles: []
        }
      ]
    };

    const res = await app.inject({
      method: 'PUT',
      url: `/api/rooms/${roomId}/import`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      payload: importPayload,
    });

    expect(res.statusCode).toBe(204);

    // Find the insert query call for room_node_positions
    const insertCall = clientMock.query.mock.calls.find((call: any) => 
        typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_positions')
    );
    
    expect(insertCall).toBeDefined();
    // The arguments are [query, [id, zoneId, x, y, features, customHandles, explored]]
    const args = insertCall[1];
    expect(args[6]).toBe(true); // Index 6 is explored
  });
});
