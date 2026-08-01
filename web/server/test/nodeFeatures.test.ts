import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { wrapDbWithGuardDispatch } from './testApp.js';
import type { FastifyInstance } from 'fastify';
import { getInitialFeatures } from '../src/utils/nodeFeatures.js';

describe('getInitialFeatures', () => {
  it('returns empty features for unknown zone', () => {
    expect(getInitialFeatures('unknown')).toEqual({});
  });

  it('returns resource features for a roads zone with knownResources', () => {
    // We know 'qiient-et-qinsum' has LOGS in maps.json
    const features = getInitialFeatures('qiient-et-qinsum');
    expect(features).toEqual({ resources: [{ type: 'wood' }], upstreamFeatures: ['wood'] });
  });

  it('returns multiple resource features', () => {
     // cases-ugumlos has [ "hide", "logs", "ore", "rock", "largeGreenChest" ]
    const features = getInitialFeatures('cases-ugumlos');
    expect(features).toEqual({
      resources: [{ type: 'leather' }, { type: 'wood' }, { type: 'ore' }, { type: 'stone' }],
      treasuresGreenCount: 0,
      upstreamFeatures: ['leather', 'wood', 'ore', 'stone', 'treasuresGreenCount']
    });
  });

  it('returns cotton (unknown size) and blue treasure chest for firos-ezatam', () => {
    // firos-ezatam has knownFeatures: ["cotton", "largeBlueChest"]
    const features = getInitialFeatures('firos-ezatam');
    expect(features.resources).toEqual([{ type: 'fibre' }]);
    expect(features.treasuresBlueCount).toBe(0);
    expect(features.upstreamFeatures).toEqual(['fibre', 'treasuresBlueCount']);
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
    app = await buildApp({ db: wrapDbWithGuardDispatch(mockDb) as any, disableRateLimit: true, jwtSecret: 'test-secret' });
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
      payload: { password: 'pw', adminPassword: 'admin', homeZoneId: 'qiient-al-nusom', vanityUrl: 'test-room' },
    });

    const connectMock = await mockDb.connect();
    expect(connectMock.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO room_node_positions'),
      expect.arrayContaining([
        expect.any(String),
        'qiient-al-nusom',
        0,
        0,
        expect.stringContaining('"resources":[{"type":"ore"}]'),
        JSON.stringify(null)
      ])
    );
  });

  it('pre-populates target node features on connection creation', async () => {
    const roomId = 'test-room-id';
    const token = app.jwt.sign({ roomId });

    // Mock room existence + chain lookups
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] });
    mockDb.query.mockResolvedValueOnce({ rows: [{ chain_id: 'test-chain-id' }] }); // fromZoneId chain
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // toZoneId chain

    await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        fromZoneId: 'qiient-al-nusom',
        toZoneId: 'qiient-et-qinsum',
        secondsRemaining: 3600,
        slots: 7,
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
        expect.stringContaining('"resources":[{"type":"wood"}]'),
      ])
    );
    
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO room_node_positions'),
      expect.arrayContaining([
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        expect.any(Number),
        expect.stringContaining('"lastUpdatedAt":'),
      ])
    );
  });

  it('applies zone memory features and handles when adding a node with existing memory', async () => {
    const roomId = 'test-room-id';
    const token = app.jwt.sign({ roomId });

    const memoryFeatures = { resources: [{ type: 'stone', small: 2, large: 1 }] };
    const memoryHandles = [{ id: 'h1', left: '50%', top: '0%' }];

    // Mock: room exists, connections check (empty), memory check returns an entry with features+handles
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ id: roomId }] })                          // room lookup
      .mockResolvedValueOnce({ rows: [{ chain_id: 'test-chain-id' }] })           // fromZoneId chain lookup
      .mockResolvedValueOnce({ rows: [] })                                        // toZoneId chain lookup
      .mockResolvedValueOnce({ rows: [] })                                        // connections check (cycle detection)
      .mockResolvedValueOnce({ rows: [{ features: memoryFeatures, custom_handles: memoryHandles }] }) // memory check
      .mockResolvedValue({ rows: [], rowCount: 0 });                              // all subsequent queries

    await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        fromZoneId: 'qiient-al-nusom',
        toZoneId: 'qiient-et-qinsum',
        secondsRemaining: 3600,
        slots: 7,
        targetPosition: { x: 200, y: 300 }
      },
    });

    // The node insert should use the memory features (stone resource) not the default (wood)
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO room_node_positions'),
      expect.arrayContaining([
        roomId,
        'qiient-et-qinsum',
        200,
        300,
        expect.stringContaining('"stone"'),
        JSON.stringify(memoryHandles),
      ])
    );

    // Should NOT use the default initial features (wood) since memory overrides them
    const insertCall = mockDb.query.mock.calls.find(
      (call: any[]) =>
        typeof call[0] === 'string' &&
        call[0].includes('INSERT INTO room_node_positions') &&
        Array.isArray(call[1]) &&
        call[1].includes('qiient-et-qinsum')
    );
    expect(insertCall).toBeDefined();
    expect(insertCall[1][4]).not.toContain('"wood"');
  });
});
