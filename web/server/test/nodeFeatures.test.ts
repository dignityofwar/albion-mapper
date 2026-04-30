import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { getInitialFeatures } from '../src/utils/nodeFeatures.js';

describe('getInitialFeatures', () => {
  it('returns empty features for unknown zone', () => {
    expect(getInitialFeatures('unknown')).toEqual({});
  });

  it('returns resource features for a roads zone with knownResources', () => {
    // We know 'qiient-et-qinsum' has LOGS in maps.json
    const features = getInitialFeatures('qiient-et-qinsum');
    expect(features).toEqual({ resourceWood: true });
  });

  it('returns multiple resource features', () => {
     // cases-ugumlos has [ "LOGS", "ORE", "ROCK" ]
    const features = getInitialFeatures('cases-ugumlos');
    expect(features).toEqual({
      resourceWood: true,
      resourceOre: true,
      resourceStone: true
    });
  });
});

describe('Auto-pre-population in routes', () => {
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

  it('pre-populates home zone features on room creation', async () => {
    // qiient-al-nusom is a valid roads home
    await app.inject({
      method: 'POST',
      url: '/api/rooms',
      payload: { password: 'pw', adminPassword: 'admin', homeZoneId: 'qiient-al-nusom' },
    });

    const connectMock = await mockDb.connect();
    expect(connectMock.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO room_node_positions'),
      expect.arrayContaining([
        expect.any(String),
        'qiient-al-nusom',
        0,
        0,
        JSON.stringify({ resourceOre: true }),
        JSON.stringify(null)
      ])
    );
  });

  it('pre-populates target node features on connection creation', async () => {
    const roomId = 'test-room-id';
    const token = app.jwt.sign({ roomId });

    // Mock room existence
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] });

    await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        fromZoneId: 'qiient-al-nusom',
        toZoneId: 'qiient-et-qinsum',
        secondsRemaining: 3600,
        targetPosition: { x: 100, y: 100 }
      },
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO room_node_positions'),
      expect.arrayContaining([
        roomId,
        'qiient-et-qinsum',
        100,
        100,
        JSON.stringify({ resourceWood: true })
      ])
    );
  });
});
