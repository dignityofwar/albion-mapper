import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

const VALID_ZONE_ID = 'qiient-al-nusom';

let app: FastifyInstance;
let mockDb: any;

beforeEach(async () => {
  mockDb = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: vi.fn().mockReturnValue({
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

describe('Room Creation - Node Initialization', () => {
  it('should initialize the home zone node position when a room is created', async () => {
    mockDb.query.mockResolvedValue({ rowCount: 1, rows: [] });
    
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'secret', adminPassword: 'admin', homeZoneId: VALID_ZONE_ID },
    });
    
    expect(res.statusCode).toBe(201);
    
    // Check if INSERT into room_node_positions was called on the client
    const client = await mockDb.connect.mock.results[0].value;
    const insertNodePositionCall = client.query.mock.calls.find(call => 
      typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_positions')
    );
    
    expect(insertNodePositionCall, 'Should have inserted home zone node position').toBeDefined();
    expect(insertNodePositionCall![1]).toContain(VALID_ZONE_ID);
  });
});
