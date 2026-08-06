/**
 * Regression tests for saving hideout portal (custom handle) configuration.
 *
 * Bug: the ZoneHandleEditor save used to send TWO WebSocket messages —
 * `rotate_zone` followed by `update_node_positions`. The server's rotate_zone
 * handler read the *old* custom_handles from the DB and broadcast them to
 * every client INCLUDING the sender, while the later update_node_positions
 * broadcast (carrying the new handles) EXCLUDED the sender. Net effect: the
 * editing user's screen reverted to the old portals until a full page reload,
 * even though the DB held the new configuration.
 *
 * Fix: `rotate_zone` now accepts an optional `customHandles` payload so the
 * editor save is a single atomic operation. These tests verify that:
 *   1. The sending socket receives a node_positions_updated broadcast whose
 *      handles are the NEW ones from the message (not the stale DB set).
 *   2. The DB UPDATE persists the new handles.
 *   3. The memory mirror is an upsert, so a first-time hideout configuration
 *      (no room_node_memory row yet) creates one and broadcasts memory_updated.
 *   4. Non-hideout (shaped roads) zones canonicalize the provided handles.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupTestApp } from './testApp.js';
import type { FastifyInstance } from 'fastify';
import { canonicalizeHandlesForRotation, getShapeHandlePositions, ZONE_BY_ID } from 'shared';

// A roads hideout zone — confirmed present in the zone DB with type 'roadsHideout'.
const HIDEOUT_ZONE = 'qiient-al-nusom';
// A shaped (non-hideout) roads zone used for the canonicalization test.
const ROADS_ZONE = 'cases-ugumlos';
const ROADS_SHAPE = 'c';

const OLD_HANDLES = [{ id: 'custom-old1', left: '75.00%', top: '25.00%' }];
const NEW_HANDLES = [
  { id: 'custom-a', left: '25.00%', top: '25.00%' },
  { id: 'custom-b', left: '75.00%', top: '75.00%' },
];

const testApp = setupTestApp();
let app: FastifyInstance;
let mockDb: any;
let token: string;
const { roomId } = testApp;

beforeEach(() => {
  ({ app, mockDb, token } = testApp);
});

async function connectWs(roomIdParam: string) {
  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : 3001;
  const { WebSocket } = await import('ws');
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/rooms/${roomIdParam}`);
  await new Promise<void>((resolve, reject) => {
    socket.on('open', resolve);
    socket.on('error', reject);
  });
  return socket;
}

function mockAuthSync(homeZoneId: string, existingPositionRow?: object) {
  mockDb.query.mockResolvedValueOnce({
    rows: [{ id: roomId, home_zone_id: homeZoneId, created_at: new Date().toISOString(), chain_migrated: true }],
  }); // room
  mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'chain-1', source_zone_id: homeZoneId }] }); // chains
  mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections
  mockDb.query.mockResolvedValueOnce({ rows: existingPositionRow ? [existingPositionRow] : [] }); // node positions
  mockDb.query.mockResolvedValueOnce({ rows: [] }); // memory
}

function makeRotateClient(existingRow: object) {
  return {
    query: vi.fn().mockImplementation((q: string) => {
      if (q.includes('SELECT home_zone_id FROM rooms'))
        return Promise.resolve({ rows: [{ home_zone_id: HIDEOUT_ZONE }] });
      if (q.includes('SELECT zone_id, x, y, features, custom_handles'))
        return Promise.resolve({ rows: [existingRow] });
      return Promise.resolve({ rows: [], rowCount: 1 });
    }),
    release: vi.fn(),
  };
}

describe('hideout portal save (rotate_zone with customHandles)', () => {
  it('sanity: the test zone really is a roadsHideout in the zone DB', () => {
    expect(ZONE_BY_ID.get(HIDEOUT_ZONE)?.type).toBe('roadsHideout');
  });

  it('echoes the NEW handles back to the SENDING socket (not the stale DB handles)', async () => {
    const existingRow = {
      zone_id: HIDEOUT_ZONE,
      x: 0,
      y: 0,
      features: {},
      custom_handles: OLD_HANDLES, // ← stale state the old bug echoed back
      rotation: 0,
      explored: true,
      chain_id: 'chain-1',
    };

    mockAuthSync(HIDEOUT_ZONE, existingRow);
    const mockClient = makeRotateClient(existingRow);
    mockDb.connect.mockResolvedValue(mockClient);

    await app.listen({ port: 0 });
    const socket = await connectWs(roomId);
    const messages: any[] = [];
    socket.on('message', (data) => messages.push(JSON.parse(data.toString())));

    socket.send(JSON.stringify({ type: 'auth', token }));
    await new Promise((r) => setTimeout(r, 200));
    messages.length = 0;

    // User moved/deleted portals in the editor and hit Save.
    socket.send(JSON.stringify({ type: 'rotate_zone', zoneId: HIDEOUT_ZONE, rotation: 0, customHandles: NEW_HANDLES }));
    await new Promise((r) => setTimeout(r, 200));

    // The SENDER must receive the authoritative broadcast — this is the whole
    // point of the fix: the editing user sees their change live.
    const update = messages.find((m) => m.type === 'node_positions_updated');
    expect(update).toBeDefined();
    expect(update.nodePositions).toHaveLength(1);
    expect(update.nodePositions[0].zoneId).toBe(HIDEOUT_ZONE);
    expect(update.nodePositions[0].customHandles).toEqual(NEW_HANDLES);

    socket.close();
  });

  it('persists the new handles in the DB UPDATE', async () => {
    const existingRow = {
      zone_id: HIDEOUT_ZONE,
      x: 0,
      y: 0,
      features: {},
      custom_handles: OLD_HANDLES,
      rotation: 0,
      explored: true,
      chain_id: 'chain-1',
    };

    mockAuthSync(HIDEOUT_ZONE, existingRow);
    const mockClient = makeRotateClient(existingRow);
    mockDb.connect.mockResolvedValue(mockClient);

    await app.listen({ port: 0 });
    const socket = await connectWs(roomId);

    socket.send(JSON.stringify({ type: 'auth', token }));
    await new Promise((r) => setTimeout(r, 200));

    socket.send(JSON.stringify({ type: 'rotate_zone', zoneId: HIDEOUT_ZONE, rotation: 0, customHandles: NEW_HANDLES }));
    await new Promise((r) => setTimeout(r, 200));

    const updateCall = mockClient.query.mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('UPDATE room_node_positions SET rotation'),
    );
    expect(updateCall).toBeDefined();
    const params = updateCall![1] as any[];
    expect(params[1]).toBe(HIDEOUT_ZONE);
    expect(JSON.parse(params[3])).toEqual(NEW_HANDLES);

    socket.close();
  });

  it('deleting every portal is echoed back as an empty handle set', async () => {
    const existingRow = {
      zone_id: HIDEOUT_ZONE,
      x: 0,
      y: 0,
      features: {},
      custom_handles: OLD_HANDLES,
      rotation: 0,
      explored: true,
      chain_id: 'chain-1',
    };

    mockAuthSync(HIDEOUT_ZONE, existingRow);
    const mockClient = makeRotateClient(existingRow);
    mockDb.connect.mockResolvedValue(mockClient);

    await app.listen({ port: 0 });
    const socket = await connectWs(roomId);
    const messages: any[] = [];
    socket.on('message', (data) => messages.push(JSON.parse(data.toString())));

    socket.send(JSON.stringify({ type: 'auth', token }));
    await new Promise((r) => setTimeout(r, 200));
    messages.length = 0;

    socket.send(JSON.stringify({ type: 'rotate_zone', zoneId: HIDEOUT_ZONE, rotation: 0, customHandles: [] }));
    await new Promise((r) => setTimeout(r, 200));

    const update = messages.find((m) => m.type === 'node_positions_updated');
    expect(update).toBeDefined();
    const echoed = update.nodePositions[0].customHandles;
    expect(echoed == null || echoed.length === 0).toBe(true);

    socket.close();
  });

  it('first-time configuration (no memory row) upserts room_node_memory and broadcasts memory_updated', async () => {
    const existingRow = {
      zone_id: HIDEOUT_ZONE,
      x: 0,
      y: 0,
      features: {},
      custom_handles: null, // ← brand new hideout, no history
      rotation: 0,
      explored: false,
      chain_id: 'chain-1',
    };

    mockAuthSync(HIDEOUT_ZONE, existingRow);
    const mockClient = makeRotateClient(existingRow);
    mockDb.connect.mockResolvedValue(mockClient);

    await app.listen({ port: 0 });
    const socket = await connectWs(roomId);
    const messages: any[] = [];
    socket.on('message', (data) => messages.push(JSON.parse(data.toString())));

    socket.send(JSON.stringify({ type: 'auth', token }));
    await new Promise((r) => setTimeout(r, 200));

    // After auth, route pool queries by SQL so the memory upsert/read work.
    const memLastUpdated = new Date().toISOString();
    mockDb.query.mockImplementation((q: string) => {
      if (typeof q === 'string' && q.includes('SELECT zone_id, times_added, features, custom_handles'))
        return Promise.resolve({
          rows: [{
            zone_id: HIDEOUT_ZONE,
            times_added: [memLastUpdated],
            features: null,
            custom_handles: NEW_HANDLES,
            rotation: 0,
            last_updated: memLastUpdated,
          }],
        });
      return Promise.resolve({ rows: [], rowCount: 1 });
    });
    messages.length = 0;

    socket.send(JSON.stringify({ type: 'rotate_zone', zoneId: HIDEOUT_ZONE, rotation: 0, customHandles: NEW_HANDLES }));
    await new Promise((r) => setTimeout(r, 200));

    // The memory mirror must be an INSERT ... ON CONFLICT upsert (an UPDATE
    // would no-op for a first-time hideout and lose the configuration).
    const upsertCall = mockClient.query.mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_memory'),
    );
    expect(upsertCall).toBeDefined();

    // And it must run on the transaction's client, never the pool: the room row
    // is held FOR UPDATE, so a second connection here blocks on the FK check and
    // deadlocks against the transaction that is waiting for it to return.
    const pooledUpsert = mockDb.query.mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_memory'),
    );
    expect(pooledUpsert).toBeUndefined();
    const upsertParams = upsertCall![1] as any[];
    expect(upsertParams[0]).toBe(roomId);
    expect(upsertParams[1]).toBe(HIDEOUT_ZONE);
    expect(JSON.parse(upsertParams[2])).toEqual(NEW_HANDLES);

    // And every client is told about the new memory entry.
    const memUpdate = messages.find((m) => m.type === 'memory_updated');
    expect(memUpdate).toBeDefined();
    expect(memUpdate.entry.zoneId).toBe(HIDEOUT_ZONE);
    expect(memUpdate.entry.customHandles).toEqual(NEW_HANDLES);

    socket.close();
  });

  it('shaped (non-hideout) roads zones canonicalize the provided handles for the requested rotation', async () => {
    const defaults = getShapeHandlePositions(ROADS_SHAPE);
    const existingRow = {
      zone_id: ROADS_ZONE,
      x: 0,
      y: 0,
      features: {},
      custom_handles: null, // DB is stale/empty — message handles must win
      rotation: 0,
      explored: true,
      chain_id: 'chain-1',
    };

    mockAuthSync(ROADS_ZONE, existingRow);
    const mockClient = {
      query: vi.fn().mockImplementation((q: string) => {
        if (q.includes('SELECT home_zone_id FROM rooms'))
          return Promise.resolve({ rows: [{ home_zone_id: ROADS_ZONE }] });
        if (q.includes('SELECT zone_id, x, y, features, custom_handles'))
          return Promise.resolve({ rows: [existingRow] });
        return Promise.resolve({ rows: [], rowCount: 1 });
      }),
      release: vi.fn(),
    };
    mockDb.connect.mockResolvedValue(mockClient);

    await app.listen({ port: 0 });
    const socket = await connectWs(roomId);
    const messages: any[] = [];
    socket.on('message', (data) => messages.push(JSON.parse(data.toString())));

    socket.send(JSON.stringify({ type: 'auth', token }));
    await new Promise((r) => setTimeout(r, 200));
    messages.length = 0;

    socket.send(JSON.stringify({ type: 'rotate_zone', zoneId: ROADS_ZONE, rotation: 1, customHandles: defaults }));
    await new Promise((r) => setTimeout(r, 200));

    const update = messages.find((m) => m.type === 'node_positions_updated');
    expect(update).toBeDefined();
    const expected = canonicalizeHandlesForRotation('roads', ROADS_SHAPE, defaults, 1);
    expect(update.nodePositions[0].rotation).toBe(1);
    expect(update.nodePositions[0].customHandles).toEqual(expected);

    socket.close();
  });
});
