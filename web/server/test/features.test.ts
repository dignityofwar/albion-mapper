import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

const VALID_ZONE_A = 'adrens-hill';
const VALID_ZONE_B = 'anklesnag-mire';

let app: FastifyInstance;
let roomId = 'test-room-id';
let token: string;
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

  token = app.jwt.sign({ roomId });
});

afterEach(async () => {
  await app.close();
});

async function connectWs(roomIdParam: string): Promise<{ socket: import('ws').WebSocket; close: () => void }> {
  const address = app.server.address();
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
    await app.listen({ port: 0 });

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
    // ws.ts:125 - SELECT home_zone_id FROM rooms WHERE id = $1
    mockDb.query.mockResolvedValueOnce({ rows: [{ home_zone_id: VALID_ZONE_A }] }); 
    // ws.ts:132 - SELECT x, y FROM room_node_positions WHERE room_id = $1 AND zone_id = $2
    mockDb.query.mockResolvedValueOnce({ rows: [{ x: 100, y: 100 }] }); 
    
    socket.send(JSON.stringify({ type: 'update_node_positions', nodePositions }));

    await new Promise((r) => setTimeout(r, 100));

    // Verify DB calls
    expect(mockClient.query).toHaveBeenCalledWith('DELETE FROM room_node_positions WHERE room_id = $1', [roomId]);
    
    // Verify first node features (reds and powercoreGreen)
    expect(mockClient.query).toHaveBeenCalledWith(
      'INSERT INTO room_node_positions (room_id, zone_id, x, y, features) VALUES ($1, $2, $3, $4, $5)',
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
      'INSERT INTO room_node_positions (room_id, zone_id, x, y, features) VALUES ($1, $2, $3, $4, $5)',
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

    await app.listen({ port: 0 });

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

  it('saves node features even for a single node (home zone)', async () => {
    await app.listen({ port: 0 });

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
    mockDb.query.mockResolvedValueOnce({ rows: [{ home_zone_id: VALID_ZONE_A }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rows: [{ x: 0, y: 0 }] }); // homePos check
    
    socket.send(JSON.stringify({ type: 'update_node_positions', nodePositions }));

    await new Promise((r) => setTimeout(r, 100));

    // This ensures that the fix (removing length <= 1 guard) works
    expect(mockClient.query).toHaveBeenCalledWith('DELETE FROM room_node_positions WHERE room_id = $1', [roomId]);
    expect(mockClient.query).toHaveBeenCalledWith(
      'INSERT INTO room_node_positions (room_id, zone_id, x, y, features) VALUES ($1, $2, $3, $4, $5)',
      expect.arrayContaining([roomId, VALID_ZONE_A, 0, 0, JSON.stringify({ reds: 5 })])
    );

    socket.close();
  });
});
