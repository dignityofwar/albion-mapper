import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupTestApp } from './testApp.js';
import type { FastifyInstance } from 'fastify';
import { type Connection, UpdateConnectionBodySchema } from 'shared';

const VALID_ZONE_A = 'qiient-al-nusom';
const VALID_ZONE_B = 'qiient-al-odesum';
const UNKNOWN_ZONE = 'totally-unknown-zone-xyz';

const testApp = setupTestApp();
const { roomId } = testApp;
let app: FastifyInstance;
let mockDb: any;
let token: string;

beforeEach(() => {
  ({ app, mockDb, token } = testApp);
});

describe('POST /api/rooms/:id/connections', () => {
  it('creates a connection and returns it', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT connection
    
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, secondsRemaining: 1800, slots: 7 },
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
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_A, secondsRemaining: 1800, slots: 7 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/same-zone/i);
  });

  it('rejects unknown fromZoneId', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: UNKNOWN_ZONE, toZoneId: VALID_ZONE_B, secondsRemaining: 1800, slots: 7 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/zone catalogue/i);
  });

  it('rejects unknown toZoneId', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: UNKNOWN_ZONE, secondsRemaining: 1800, slots: 7 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/zone catalogue/i);
  });

  it('rejects secondsRemaining = 0', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, secondsRemaining: 0, slots: 7 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects secondsRemaining > 86400', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, secondsRemaining: 86401, slots: 7 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects connection that creates a cycle', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    // Return an existing connection: VALID_ZONE_B -> VALID_ZONE_A
    mockDb.query.mockResolvedValueOnce({ rows: [{ 
      id: 'conn-1', 
      room_id: roomId, 
      from_zone_id: VALID_ZONE_B, 
      to_zone_id: VALID_ZONE_A, 
      from_handle_id: null, 
      to_handle_id: null, 
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), 
      reported_at: new Date().toISOString(), 
      reported_by: null 
    }] });

    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      // Try to create: VALID_ZONE_A -> VALID_ZONE_B
      // Cycle: A -> B -> A
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, secondsRemaining: 1800, slots: 7 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/cycle/i);
  });

  it('rejects connection when source handle is already occupied', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [{
      id: 'conn-existing',
      room_id: roomId,
      from_zone_id: VALID_ZONE_A,
      to_zone_id: 'zone-other',
      from_handle_id: 'handle-1',
      to_handle_id: null,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      reported_at: new Date().toISOString(),
      reported_by: null
    }] }); // connections check — handle-1 on VALID_ZONE_A already occupied

    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, secondsRemaining: 1800, slots: 7, fromHandleId: 'handle-1' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/already exists on this source handle/i);
  });

  it('rejects connection when fromHandleId is disabled', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    mockDb.query.mockResolvedValueOnce({ rows: [{ custom_handles: [{ id: 'handle-1', left: '50%', top: '0%', disabled: true }] }] }); // from-zone handles

    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, secondsRemaining: 1800, slots: 7, fromHandleId: 'handle-1' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/source handle is disabled/i);
  });

  it('rejects connection when toHandleId is disabled', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    mockDb.query.mockResolvedValueOnce({ rows: [{ custom_handles: [{ id: 'handle-from', left: '50%', top: '0%' }] }] }); // from-zone handles (not disabled)
    mockDb.query.mockResolvedValueOnce({ rows: [{ custom_handles: [{ id: 'handle-2', left: '50%', top: '100%', disabled: true }] }] }); // to-zone handles

    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, secondsRemaining: 1800, slots: 7, fromHandleId: 'handle-from', toHandleId: 'handle-2' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/destination handle is disabled/i);
  });

  it('instantly creates a connection between two existing nodes using preexisting handle and time details', async () => {
    // Simulates the "replace occupied" flow: no targetPosition, specific handles, secondsRemaining derived from old connection
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check (old ones already deleted)
    mockDb.query.mockResolvedValueOnce({ rows: [{ custom_handles: [{ id: 'handle-src', left: '50%', top: '0%' }] }] }); // from-zone handles
    mockDb.query.mockResolvedValueOnce({ rows: [{ custom_handles: [{ id: 'handle-dst', left: '50%', top: '100%' }] }] }); // to-zone handles
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE source node features
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE target node features
    mockDb.query.mockResolvedValueOnce({ rows: [{ zone_id: VALID_ZONE_B, x: 0, y: 0, features: { slots: 7 }, custom_handles: null }] }); // SELECT positions
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT connection

    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      // No targetPosition — both nodes already exist; secondsRemaining and slots come from the old connection's data
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, secondsRemaining: 900, slots: 7, fromHandleId: 'handle-src', toHandleId: 'handle-dst' },
    });
    expect(res.statusCode).toBe(201);

    // Verify the INSERT connection query used the correct handle IDs
    const insertConnCall = mockDb.query.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO connections')
    );
    expect(insertConnCall).toBeDefined();
    const insertParams = insertConnCall[1];
    expect(insertParams).toContain('handle-src');
    expect(insertParams).toContain('handle-dst');
  });

  it('allows connection when handles exist but are not disabled', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    mockDb.query.mockResolvedValueOnce({ rows: [{ custom_handles: [{ id: 'handle-from', left: '50%', top: '0%' }] }] }); // from-zone handles
    mockDb.query.mockResolvedValueOnce({ rows: [{ custom_handles: [{ id: 'handle-to', left: '50%', top: '100%' }] }] }); // to-zone handles
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE source node features
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE target node features
    mockDb.query.mockResolvedValueOnce({ rows: [{ zone_id: VALID_ZONE_B, x: 0, y: 0, features: {}, custom_handles: null }] }); // SELECT positions
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT connection

    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, secondsRemaining: 1800, slots: 7, fromHandleId: 'handle-from', toHandleId: 'handle-to' },
    });
    expect(res.statusCode).toBe(201);
  });

  it('requires authorization', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, secondsRemaining: 1800, slots: 7 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects when slots is missing', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, secondsRemaining: 1800 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/slots/i);
  });

  it('rejects when slots is an invalid value', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, secondsRemaining: 1800, slots: 5 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/slots/i);
  });

  it('creates a connection with slots=7 and stores it in node features', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // memory check (no existing memory)
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT node position (target)
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE node position (source)
    mockDb.query.mockResolvedValueOnce({ rows: [{ zone_id: VALID_ZONE_B, x: 100, y: 200, features: { slots: 7 }, custom_handles: null }] }); // SELECT positions
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT connection

    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, secondsRemaining: 1800, slots: 7, targetPosition: { x: 100, y: 200 } },
    });
    expect(res.statusCode).toBe(201);

    // Verify the INSERT node position query included slots in features
    const insertCall = mockDb.query.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_positions')
    );
    expect(insertCall).toBeDefined();
    const featuresArg = JSON.parse(insertCall[1][4]);
    expect(featuresArg.slots).toBe(7);
  });

  it('creates a connection with slots=20 and stores it in node features', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // memory check (no existing memory)
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT node position (target)
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE node position (source)
    mockDb.query.mockResolvedValueOnce({ rows: [{ zone_id: VALID_ZONE_B, x: 100, y: 200, features: { slots: 20 }, custom_handles: null }] }); // SELECT positions
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT connection

    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, secondsRemaining: 1800, slots: 20, targetPosition: { x: 100, y: 200 } },
    });
    expect(res.statusCode).toBe(201);

    const insertCall = mockDb.query.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_positions')
    );
    expect(insertCall).toBeDefined();
    const featuresArg = JSON.parse(insertCall[1][4]);
    expect(featuresArg.slots).toBe(20);
  });

  it('replaces stale memory handles with fresh shape defaults when count differs for a shaped zone', async () => {
    // sases-aoarsum is a roads zone with mapShape 's' (6 default handles)
    const SHAPED_ZONE = 'sases-aoarsum';
    // Stale memory has only 5 handles (wrong count)
    const staleHandles = [
      { id: 's-p1', top: '35.55%', left: '14.45%' },
      { id: 's-p2', top: '80.47%', left: '30.47%' },
      { id: 's-p3', top: '12.11%', left: '37.89%' },
      { id: 's-p4', top: '22.27%', left: '72.27%' },
      { id: 's-p5', top: '53.52%', left: '96.48%' },
    ];

    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    mockDb.query.mockResolvedValueOnce({ rows: [{ features: { slots: 7 }, custom_handles: staleHandles }] }); // memory check
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT node position
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // SELECT times_added (no existing — shouldAppend=true)
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT/UPDATE memory
    mockDb.query.mockResolvedValueOnce({ rows: [{ zone_id: SHAPED_ZONE, times_added: [new Date().toISOString()], features: { slots: 7 }, custom_handles: staleHandles, last_updated: new Date().toISOString() }] }); // SELECT updated memory
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE source node lastUpdatedAt
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // SELECT positions (broadcast)
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT connection

    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: SHAPED_ZONE, secondsRemaining: 1800, slots: 7, targetPosition: { x: 100, y: 200 } },
    });
    expect(res.statusCode).toBe(201);

    const insertCall = mockDb.query.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_positions')
    );
    expect(insertCall).toBeDefined();
    const handlesArg = JSON.parse(insertCall[1][5]);
    expect(handlesArg).toHaveLength(6);
    expect(handlesArg.map((h: any) => h.id)).toEqual(['s-p1', 's-p2', 's-p3', 's-p4', 's-p5', 's-p6']);

    // Memory INSERT must also receive the corrected 6 handles
    const memInsertCall = mockDb.query.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_memory')
    );
    expect(memInsertCall).toBeDefined();
    const memHandlesArg = JSON.parse(memInsertCall[1][4]);
    expect(memHandlesArg).toHaveLength(6);
    expect(memHandlesArg.map((h: any) => h.id)).toEqual(['s-p1', 's-p2', 's-p3', 's-p4', 's-p5', 's-p6']);
  });

  it('replaces stale memory handles with fresh shape defaults when positions differ for a shaped zone', async () => {
    // sases-aoarsum is a roads zone with mapShape 's' (6 default handles)
    const SHAPED_ZONE = 'sases-aoarsum';
    // Memory has 6 handles but with moved positions (not matching defaults)
    const movedHandles = [
      { id: 's-p1', top: '10.00%', left: '20.00%' },
      { id: 's-p2', top: '30.00%', left: '40.00%' },
      { id: 's-p3', top: '50.00%', left: '60.00%' },
      { id: 's-p4', top: '70.00%', left: '80.00%' },
      { id: 's-p5', top: '15.00%', left: '25.00%' },
      { id: 's-p6', top: '35.00%', left: '45.00%' },
    ];

    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    mockDb.query.mockResolvedValueOnce({ rows: [{ features: { slots: 7 }, custom_handles: movedHandles }] }); // memory check
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT node position
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // SELECT times_added (no existing — shouldAppend=true)
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT/UPDATE memory
    mockDb.query.mockResolvedValueOnce({ rows: [{ zone_id: SHAPED_ZONE, times_added: [new Date().toISOString()], features: { slots: 7 }, custom_handles: movedHandles, last_updated: new Date().toISOString() }] }); // SELECT updated memory
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE source node lastUpdatedAt
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // SELECT positions (broadcast)
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT connection

    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: SHAPED_ZONE, secondsRemaining: 1800, slots: 7, targetPosition: { x: 100, y: 200 } },
    });
    expect(res.statusCode).toBe(201);

    const insertCall = mockDb.query.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_positions')
    );
    expect(insertCall).toBeDefined();
    const handlesArg = JSON.parse(insertCall[1][5]);
    // Positions should be reset to defaults
    expect(handlesArg).toHaveLength(6);
    expect(handlesArg[0].left).toBe('90.43%');
    expect(handlesArg[0].top).toBe('59.57%');

    // Memory INSERT must also receive the corrected default positions
    const memInsertCall = mockDb.query.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_memory')
    );
    expect(memInsertCall).toBeDefined();
    const memHandlesArg = JSON.parse(memInsertCall[1][4]);
    expect(memHandlesArg).toHaveLength(6);
    expect(memHandlesArg[0].left).toBe('90.43%');
    expect(memHandlesArg[0].top).toBe('59.57%');
  });

  it('preserves disabled flags from stale handles when resetting to shape defaults', async () => {
    const SHAPED_ZONE = 'sases-aoarsum';
    // Memory has 5 handles, one is disabled
    const staleHandles = [
      { id: 's-p1', top: '35.55%', left: '14.45%', disabled: true },
      { id: 's-p2', top: '80.47%', left: '30.47%' },
      { id: 's-p3', top: '12.11%', left: '37.89%' },
      { id: 's-p4', top: '22.27%', left: '72.27%' },
      { id: 's-p5', top: '53.52%', left: '96.48%' },
    ];

    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    mockDb.query.mockResolvedValueOnce({ rows: [{ features: { slots: 7 }, custom_handles: staleHandles }] }); // memory check
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT node position
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // SELECT times_added (no existing — shouldAppend=true)
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT/UPDATE memory
    mockDb.query.mockResolvedValueOnce({ rows: [{ zone_id: SHAPED_ZONE, times_added: [new Date().toISOString()], features: { slots: 7 }, custom_handles: staleHandles, last_updated: new Date().toISOString() }] }); // SELECT updated memory
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE source node lastUpdatedAt
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // SELECT positions (broadcast)
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT connection

    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: SHAPED_ZONE, secondsRemaining: 1800, slots: 7, targetPosition: { x: 100, y: 200 } },
    });
    expect(res.statusCode).toBe(201);

    const insertCall = mockDb.query.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_positions')
    );
    expect(insertCall).toBeDefined();
    const handlesArg = JSON.parse(insertCall[1][5]);
    expect(handlesArg).toHaveLength(6);
    // s-p1 was disabled in stale data — disabled flag should be preserved
    const p1 = handlesArg.find((h: any) => h.id === 's-p1');
    expect(p1.disabled).toBe(true);
    // s-p6 is new (didn't exist in stale) — should not be disabled
    const p6 = handlesArg.find((h: any) => h.id === 's-p6');
    expect(p6.disabled).toBeUndefined();

    // Memory INSERT must also receive the corrected 6 handles with disabled flag preserved
    const memInsertCall = mockDb.query.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_memory')
    );
    expect(memInsertCall).toBeDefined();
    const memHandlesArg = JSON.parse(memInsertCall[1][4]);
    expect(memHandlesArg).toHaveLength(6);
    const memP1 = memHandlesArg.find((h: any) => h.id === 's-p1');
    expect(memP1.disabled).toBe(true);
    const memP6 = memHandlesArg.find((h: any) => h.id === 's-p6');
    expect(memP6.disabled).toBeUndefined();
  });

  it('updates memory in-place when handles are stale but zone was added recently (within 3 hours)', async () => {
    const SHAPED_ZONE = 'sases-aoarsum';
    // Stale memory has only 5 handles (wrong count), added 17 minutes ago (within 3-hour guard)
    const recentTimestamp = new Date(Date.now() - 17 * 60 * 1000).toISOString();
    const staleHandles = [
      { id: 's-p1', top: '35.55%', left: '14.45%' },
      { id: 's-p2', top: '80.47%', left: '30.47%' },
      { id: 's-p3', top: '12.11%', left: '37.89%' },
      { id: 's-p4', top: '22.27%', left: '72.27%' },
      { id: 's-p5', top: '53.52%', left: '96.48%' },
    ];

    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    mockDb.query.mockResolvedValueOnce({ rows: [{ features: { slots: 7 }, custom_handles: staleHandles }] }); // memory check (returns stale)
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT node position
    mockDb.query.mockResolvedValueOnce({ rows: [{ times_added: [recentTimestamp] }] }); // SELECT times_added (recent — shouldAppend=false)
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE room_node_memory (handles corrected in-place)
    mockDb.query.mockResolvedValueOnce({ rows: [{ zone_id: SHAPED_ZONE, times_added: [recentTimestamp], features: { slots: 7 }, custom_handles: null, last_updated: new Date().toISOString() }] }); // SELECT updated memory
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE source node lastUpdatedAt
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // SELECT positions (broadcast)
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT connection

    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: SHAPED_ZONE, secondsRemaining: 1800, slots: 7, targetPosition: { x: 100, y: 200 } },
    });
    expect(res.statusCode).toBe(201);

    // Node position must have 6 corrected handles
    const insertCall = mockDb.query.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_positions')
    );
    expect(insertCall).toBeDefined();
    const handlesArg = JSON.parse(insertCall[1][5]);
    expect(handlesArg).toHaveLength(6);
    expect(handlesArg.map((h: any) => h.id)).toEqual(['s-p1', 's-p2', 's-p3', 's-p4', 's-p5', 's-p6']);

    // Memory must be updated in-place (UPDATE, not INSERT) with the corrected 6 handles
    const memUpdateCall = mockDb.query.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes('UPDATE room_node_memory')
    );
    expect(memUpdateCall).toBeDefined();
    const memHandlesArg = JSON.parse(memUpdateCall[1][0]);
    expect(memHandlesArg).toHaveLength(6);
    expect(memHandlesArg.map((h: any) => h.id)).toEqual(['s-p1', 's-p2', 's-p3', 's-p4', 's-p5', 's-p6']);

    // No new timestamp should have been appended (no INSERT INTO room_node_memory)
    const memInsertCall = mockDb.query.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_memory')
    );
    expect(memInsertCall).toBeUndefined();
  });

  it('retains hideout handles and rotation when re-adding the zone', async () => {
    const customHandles = [
      { id: 'n', left: '10%', top: '10%' }, // Moved from default 75%, 25%
      { id: 'e', left: '75%', top: '75%' },
      { id: 's', left: '25%', top: '75%' },
      { id: 'w', left: '25%', top: '25%' },
    ];

    // 1. First addition of the zone (no memory)
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ id: roomId }] }) // SELECT id FROM rooms
      .mockResolvedValueOnce({ rows: [] }) // SELECT * FROM connections
      .mockResolvedValueOnce({ rows: [] }) // memoryCheck
      .mockResolvedValueOnce({ rows: [] }) // INSERT room_node_positions
      .mockResolvedValueOnce({ rows: [] }) // shouldAppend check
      .mockResolvedValueOnce({ rows: [] }) // UPDATE room_node_positions (from)
      .mockResolvedValueOnce({ rows: [{ zone_id: VALID_ZONE_A, x: 0, y: 0, features: {}, custom_handles: null, rotation: 0 }] }) // final broadcast positions
      .mockResolvedValueOnce({ rows: [] }); // INSERT connections

    await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        fromZoneId: VALID_ZONE_A,
        toZoneId: VALID_ZONE_B,
        secondsRemaining: 1800,
        slots: 7,
        targetPosition: { x: 100, y: 100 }
      }
    });

    // 2. Re-adding the zone with custom handles in memory
    mockDb.query.mockReset();
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ id: roomId }] }) // SELECT id FROM rooms
      .mockResolvedValueOnce({ rows: [] }) // SELECT * FROM connections
      .mockResolvedValueOnce({ rows: [{
        features: { resources: ['ore'] },
        custom_handles: customHandles,
        rotation: 45
      }] }) // memoryCheck - RETURN CUSTOM HANDLES AND ROTATION
      .mockResolvedValueOnce({ rows: [] }) // INSERT room_node_positions
      .mockResolvedValueOnce({ rows: [{ times_added: [new Date().toISOString()] }] }) // shouldAppend check
      .mockResolvedValueOnce({ rows: [] }) // UPDATE room_node_positions (from)
      .mockResolvedValueOnce({ rows: [{ zone_id: VALID_ZONE_A, x: 0, y: 0, features: {}, custom_handles: null, rotation: 0 }] }) // final broadcast positions
      .mockResolvedValueOnce({ rows: [] }); // INSERT connections

    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        fromZoneId: VALID_ZONE_A,
        toZoneId: VALID_ZONE_B,
        secondsRemaining: 1800,
        slots: 7,
        targetPosition: { x: 100, y: 100 }
      }
    });

    expect(res.statusCode).toBe(201);

    // Verify what was inserted into room_node_positions
    const insertPosCall = mockDb.query.mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_positions')
    );

    const insertedHandles = JSON.parse(insertPosCall[1][5]);
    const insertedRotation = insertPosCall[1][7];

    // It should retain our custom positions
    const nHandle = insertedHandles.find((h: any) => h.id === 'n');
    expect(nHandle.left).toBe('10%');
    expect(nHandle.top).toBe('10%');
    expect(insertedRotation).toBe(45);
  });

  it('does NOT save non-roads zones to memory when creating connections', async () => {
    const VALID_ROADS_ZONE = 'cases-ugumlos'; // A roads zone
    const VALID_NON_ROADS_ZONE = 'adrens-hill'; // A royal yellow zone

    // Mock room check
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // SELECT id FROM rooms
    // Mock connections check (no cycles)
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // SELECT * FROM connections
    // Mock memory check (no existing memory)
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // SELECT times_added FROM room_node_memory

    // Test through HTTP API
    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        fromZoneId: VALID_ROADS_ZONE,
        toZoneId: VALID_NON_ROADS_ZONE,
        secondsRemaining: 1800,
        slots: 7,
        targetPosition: { x: 200, y: 200 }
      }
    });

    expect(res.statusCode).toBe(201);

    // Verify INSERT INTO room_node_memory was NOT called
    const insertCall = mockDb.query.mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_memory')
    );
    expect(insertCall).toBeUndefined();
  });
});

describe('PATCH /api/rooms/:id/connections/:connId', () => {
  it('UpdateConnectionBodySchema behavior with null', () => {
    const result = UpdateConnectionBodySchema.safeParse({ fromHandleId: null });
    expect(result.success).toBe(true);
    expect(result.data?.fromHandleId).toBe(null);
  });

  it('UpdateConnectionBodySchema behavior with empty object', () => {
    const result = UpdateConnectionBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('returns Required if body is empty', async () => {
    const connId = 'test-conn';
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

  it('returns 404 if connection not found when fromHandleId is null', async () => {
    const connId = 'test-conn';
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

    expect(res.statusCode).toBe(404);
  });

  it('updates a connection', async () => {
    // PATCH /api/rooms/:id/connections/:connId
    const connId = 'conn-1';

    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room existence check
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: connId, from_zone_id: VALID_ZONE_A, to_zone_id: VALID_ZONE_B }] }); // connection existence check
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE connections
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE room_node_positions
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // SELECT positions (for broadcast)
    mockDb.query.mockResolvedValueOnce({ rows: [{
      id: connId, room_id: roomId, from_zone_id: VALID_ZONE_A, to_zone_id: VALID_ZONE_B,
      expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
      reported_at: new Date().toISOString(), reported_by: null
    }] }); // SELECT updated connection

    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/rooms/${roomId}/connections/${connId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { secondsRemaining: 7200 },
    });

    expect(updateRes.statusCode).toBe(200);
    const updatedConn = updateRes.json<Connection>();
    expect(updatedConn.id).toBe(connId);
  });
});

describe('GET /api/rooms/:id/connections', () => {
  it('returns active and expired connections, omits deleted ones', async () => {
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

    const expiredConn = {
      id: 'expired',
      room_id: roomId,
      from_zone_id: VALID_ZONE_A,
      to_zone_id: VALID_ZONE_B,
      expires_at: new Date(now - 60 * 60 * 1000).toISOString(),
      reported_at: new Date(now - 90 * 60 * 1000).toISOString(),
      reported_by: null,
    };

    const deletedConn = {
      id: 'deleted',
      room_id: roomId,
      from_zone_id: VALID_ZONE_A,
      to_zone_id: VALID_ZONE_B,
      expires_at: new Date(now - 7 * 60 * 60 * 1000).toISOString(),
      reported_at: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
      reported_by: null,
    };

    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [activeConn, expiredConn, deletedConn] });

    const res = await app.inject({
      method: 'GET',
      url: `/api/rooms/${roomId}/connections`,
    });
    expect(res.statusCode).toBe(200);
    const connections = res.json<Connection[]>();
    const ids = connections.map((c) => c.id);

    expect(ids).toContain(activeConn.id);
    expect(ids).toContain(expiredConn.id);
    expect(ids).not.toContain(deletedConn.id);
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
  it('deletes all connections and node positions (except home) without requiring admin password', async () => {
    const zoneA = VALID_ZONE_A; // Home

    const mockClient = await mockDb.connect();
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [{ admin_password_hash: 'irrelevant', home_zone_id: zoneA }] }); // SELECT room
    mockClient.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // DELETE FROM connections
    mockClient.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // DELETE FROM room_node_positions
    mockClient.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE rooms
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it('returns 403 when token is for a different room', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/rooms/other-room-id/connections`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 404 when room does not exist', async () => {
    const mockClient = await mockDb.connect();
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // SELECT room — not found
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('Connection lastUpdatedAt refresh', () => {
  it('updates lastUpdatedAt for source and target zones on POST', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections check
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT node position (target)
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE node position (source)
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // SELECT positions (for broadcast)
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT connection

    const res = await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, secondsRemaining: 1800, slots: 7 },
    });

    expect(res.statusCode).toBe(201);

    const updateCalls = mockDb.query.mock.calls.filter((call: any[]) =>
      call[0].includes('UPDATE room_node_positions') || call[0].includes('INSERT INTO room_node_positions')
    );

    // Should have calls that set lastUpdatedAt
    const lastUpdateCalls = updateCalls.filter((call: any[]) => call[0].includes('lastUpdatedAt'));
    expect(lastUpdateCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('updates lastUpdatedAt for both zones on PATCH', async () => {
    const connId = 'conn-1';
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: connId, from_zone_id: VALID_ZONE_A, to_zone_id: VALID_ZONE_B }] }); // connection check
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE connection
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE node positions
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // SELECT positions (for broadcast)
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: connId, expires_at: new Date().toISOString() }] }); // SELECT updated connection

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/rooms/${roomId}/connections/${connId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { secondsRemaining: 3600 },
    });

    expect(res.statusCode).toBe(200);

    const updateCall = mockDb.query.mock.calls.find((call: any[]) =>
      call[0].includes('UPDATE room_node_positions') && call[0].includes('lastUpdatedAt')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall[1]).toContain(VALID_ZONE_A);
    expect(updateCall[1]).toContain(VALID_ZONE_B);
  });
});
