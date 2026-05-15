import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupTestApp } from './testApp.js';
import type { FastifyInstance } from 'fastify';
import { ZONE_BY_ID } from 'shared';
import { WebSocket } from 'ws';

const roomId = 'test-room';
const token = 'test-token';
const VALID_ROADS_ZONE = 'cases-ugumlos'; // A roads zone
const VALID_NON_ROADS_ZONE = 'adrens-hill'; // A royal yellow zone

describe('Zone Memory Exclusion', () => {
  const testApp = setupTestApp();

  async function connectWs(roomIdParam: string) {
    const { app } = testApp;
    const baseUrl = `ws://localhost:${(app!.server.address() as any).port}`;
    const socket = new WebSocket(`${baseUrl}/ws/rooms/${roomIdParam}`);
    await new Promise((resolve, reject) => {
      socket.on('open', resolve);
      socket.on('error', reject);
    });
    return { socket };
  }

  it('does NOT save non-roads zones to memory when updating node positions', async () => {
    const { app, mockDb, token, roomId } = testApp;
    await app!.listen({ port: 0 });

    const { socket } = await connectWs(roomId);

    // Auth mocks
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId, home_zone_id: VALID_ROADS_ZONE, created_at: new Date().toISOString() }] });
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // node positions
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // memory sync

    socket.send(JSON.stringify({ type: 'auth', token }));
    await new Promise((r) => setTimeout(r, 100));

    const nodePositions = [
      {
        zoneId: VALID_NON_ROADS_ZONE,
        x: 100,
        y: 100,
        features: {
          treasuresGreenCount: 3
        }
      }
    ];

    const mockClient = await mockDb.connect();
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [{ home_zone_id: VALID_ROADS_ZONE }] }); // room lock
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // DELETE room_node_positions
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // INSERT room_node_positions
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

    // Re-read after save
    mockDb.query.mockResolvedValueOnce({ rows: [{ zone_id: VALID_NON_ROADS_ZONE, x: 100, y: 100, features: nodePositions[0].features, custom_handles: null, explored: true }] });

    socket.send(JSON.stringify({ type: 'update_node_positions', nodePositions }));
    await new Promise((r) => setTimeout(r, 150));

    // Verify UPDATE room_node_memory was NOT called for non-roads zone
    const updateCall = mockDb.query.mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('UPDATE room_node_memory')
    );
    expect(updateCall).toBeUndefined();

    socket.close();
  });

  it('does NOT save non-roads zones to memory when creating connections', async () => {
    const { app, mockDb, token, roomId } = testApp;
    
    // Mock room check
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // SELECT id FROM rooms
    // Mock connections check (no cycles)
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // SELECT * FROM connections
    // Mock memory check (no existing memory)
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // SELECT times_added FROM room_node_memory
    
    // Test through HTTP API
    const res = await app!.inject({
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

    if (res.statusCode !== 201) {
      console.log('Error payload:', res.payload);
    }
    expect(res.statusCode).toBe(201);

    // Verify INSERT INTO room_node_memory was NOT called
    const insertCall = mockDb.query.mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO room_node_memory')
    );
    expect(insertCall).toBeUndefined();
  });
});
