import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupTestApp } from './testApp.js';
import type { FastifyInstance } from 'fastify';

const VALID_ZONE_A = 'cases-ugumlos';
const VALID_ZONE_B = 'casitos-alieam';

const testApp = setupTestApp();
const { roomId } = testApp;
let app: FastifyInstance;
let mockDb: any;
let token: string;

beforeEach(() => {
  ({ app, mockDb, token } = testApp);
});

async function connectWs(roomIdParam: string): Promise<{ socket: import('ws').WebSocket; close: () => void }> {
  // We need to cast app as any or define types properly because app might be undefined
  const appInstance = testApp.app as any;
  const address = appInstance.server.address();
  const port = typeof address === 'object' && address ? address.port : 3001;
  const { WebSocket } = await import('ws');
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/rooms/${roomIdParam}`);
  await new Promise<void>((resolve, reject) => {
    socket.on('open', resolve);
    socket.on('error', reject);
  });
  return { socket, close: () => socket.close() };
}

describe('Node features persistence', () => {
  it('saves and loads node features including all powercore types', async () => {
    const { app, mockDb, token } = testApp;
    await app!.listen({ port: 0 });

    const { socket } = await connectWs(roomId);
    
    // Auth mocks
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId, home_zone_id: VALID_ZONE_A, created_at: new Date().toISOString() }] }); // room
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // node positions
    
    socket.send(JSON.stringify({ type: 'auth', token }));
    
    // Wait for sync
    await new Promise((r) => setTimeout(r, 100));

    // Update node positions with various features
    const nodePositions = [
      { 
        zoneId: VALID_ZONE_A, 
        x: 100, 
        y: 100, 
        features: { 
          reds: 5,
          powercoreGreen: true 
        } 
      },
      { 
        zoneId: VALID_ZONE_B, 
        x: 200, 
        y: 200, 
        features: { 
          powercoreBlue: true,
          powercorePurple: true 
        } 
      }
    ];

    const mockClient = await mockDb.connect();
    // ws.ts:140 - BEGIN
    // ws.ts:143 - SELECT home_zone_id FROM rooms WHERE id = $1 FOR UPDATE
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [{ home_zone_id: VALID_ZONE_A }] }); 
    // ws.ts:154 - SELECT x, y FROM room_node_positions WHERE room_id = $1 AND zone_id = $2
    mockClient.query.mockResolvedValueOnce({ rows: [{ x: 100, y: 100 }] }); 
    
    socket.send(JSON.stringify({ type: 'update_node_positions', nodePositions }));

    await new Promise((r) => setTimeout(r, 100));

    // Verify DB calls
    expect(mockClient.query).toHaveBeenCalledWith('DELETE FROM room_node_positions WHERE room_id = $1', [roomId]);
    
    // Verify first node features (reds and powercoreGreen)
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO room_node_positions'),
      expect.arrayContaining([
        roomId, 
        VALID_ZONE_A, 
        100, 
        100, 
        JSON.stringify({ reds: 5, powercoreGreen: true })
      ])
    );

    // Verify second node features (powercoreBlue and powercorePurple)
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO room_node_positions'),
      expect.arrayContaining([
        roomId, 
        VALID_ZONE_B, 
        200, 
        200, 
        JSON.stringify({ powercoreBlue: true, powercorePurple: true })
      ])
    );

    socket.close();
  });

  it('sends features back in sync message', async () => {
    const { app, mockDb, token } = testApp;
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId, home_zone_id: VALID_ZONE_A, created_at: new Date().toISOString() }] }); // room
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections
    mockDb.query.mockResolvedValueOnce({ rows: [
        { 
          zone_id: VALID_ZONE_A, 
          x: 100, 
          y: 100, 
          features: { reds: 5, powercoreGreen: true } 
        }
    ] }); // node positions

    await app!.listen({ port: 0 });

    const { socket } = await connectWs(roomId);
    
    const messages: any[] = [];
    socket.on('message', (data) => messages.push(JSON.parse(data.toString())));

    socket.send(JSON.stringify({ type: 'auth', token }));

    await new Promise((r) => setTimeout(r, 200));

    const syncMsg = messages.find(m => m.type === 'sync');
    expect(syncMsg).toBeDefined();
    expect(syncMsg.nodePositions[0].features).toEqual({ reds: 5, powercoreGreen: true });

    socket.close();
  });

  it('saves avalonian treasures to memory but excludes crystalCreaturePresent and timed chest', async () => {
    const { app, mockDb, token } = testApp;
    await app!.listen({ port: 0 });

    const { socket } = await connectWs(roomId);

    // Auth mocks (4 calls: room, connections, node_positions, memory)
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId, home_zone_id: VALID_ZONE_A, created_at: new Date().toISOString() }] });
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // node positions
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // memory sync

    socket.send(JSON.stringify({ type: 'auth', token }));
    await new Promise((r) => setTimeout(r, 100));

    const nodePositions = [
      {
        zoneId: VALID_ZONE_A,
        x: 100,
        y: 100,
        features: {
          treasuresGreenCount: 3,
          treasuresBlueCount: 1,
          crystalCreaturePresent: true, // should NOT be saved to memory
          chest: true,                  // should NOT be saved to memory (timed)
          chestTimer: 9999999,          // should NOT be saved to memory (timed)
        }
      }
    ];

    const mockClient = await mockDb.connect();
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [{ home_zone_id: VALID_ZONE_A }] }); // room lock
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // DELETE room_node_positions
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // INSERT room_node_positions
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

    // Re-read after save (app.db.query)
    mockDb.query.mockResolvedValueOnce({ rows: [{ zone_id: VALID_ZONE_A, x: 100, y: 100, features: nodePositions[0].features, custom_handles: null, explored: true }] });

    // Memory: zone exists in memory
    mockDb.query.mockResolvedValueOnce({ rows: [{ zone_id: VALID_ZONE_A }] }); // SELECT zone_id FROM room_node_memory
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // UPDATE room_node_memory
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // SELECT after update

    socket.send(JSON.stringify({ type: 'update_node_positions', nodePositions }));
    await new Promise((r) => setTimeout(r, 150));

    // Verify memory update includes treasures but NOT crystalCreaturePresent or chest/chestTimer
    // The 7th call should be the UPDATE room_node_memory with only treasure fields
    const updateCall = mockDb.query.mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('UPDATE room_node_memory')
    );
    expect(updateCall).toBeDefined();
    const savedFeatures = JSON.parse(updateCall[1][0]);
    expect(savedFeatures).toEqual({ treasuresGreenCount: 3, treasuresBlueCount: 1 });
    expect(savedFeatures).not.toHaveProperty('crystalCreaturePresent');
    expect(savedFeatures).not.toHaveProperty('chest');
    expect(savedFeatures).not.toHaveProperty('chestTimer');

    socket.close();
  });

  it('saves node features even for a single node (home zone)', async () => {
    const { app, mockDb, token } = testApp;
    await app!.listen({ port: 0 });

    const { socket } = await connectWs(roomId);
    
    // Auth mocks
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId, home_zone_id: VALID_ZONE_A, created_at: new Date().toISOString() }] }); // room
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // node positions
    
    socket.send(JSON.stringify({ type: 'auth', token }));
    await new Promise((r) => setTimeout(r, 100));

    // Update single node with features
    const nodePositions = [
      { zoneId: VALID_ZONE_A, x: 0, y: 0, features: { reds: 5 } }
    ];

    const mockClient = await mockDb.connect();
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [{ home_zone_id: VALID_ZONE_A }] }); // room check
    mockClient.query.mockResolvedValueOnce({ rows: [{ x: 0, y: 0 }] }); // homePos check
    
    socket.send(JSON.stringify({ type: 'update_node_positions', nodePositions }));

    await new Promise((r) => setTimeout(r, 100));

    // This ensures that the fix (removing length <= 1 guard) works
    expect(mockClient.query).toHaveBeenCalledWith('DELETE FROM room_node_positions WHERE room_id = $1', [roomId]);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO room_node_positions'),
      expect.arrayContaining([roomId, VALID_ZONE_A, 0, 0, JSON.stringify({ reds: 5 })])
    );

    socket.close();
  });
});
