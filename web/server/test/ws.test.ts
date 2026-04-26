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

function waitForMessage(ws: Awaited<ReturnType<typeof connectWs>>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    ws.socket.once('message', (data) => {
      try {
        resolve(JSON.parse(data.toString()));
      } catch (e) {
        reject(e);
      }
    });
  });
}

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

describe('WebSocket authentication', () => {
  it('closes with code 4401 when invalid token is provided immediately', async () => {
    await app.listen({ port: 0 });

    const { socket } = await connectWs(roomId);

    const closeCode = await new Promise<number>((resolve) => {
      socket.on('close', (code) => resolve(code));
      // Send a token that is structurally valid JWT but signed with wrong secret
      socket.send(JSON.stringify({ type: 'auth', token: 'bad.token.value' }));
    });

    expect(closeCode).toBe(4401);
  });

  it('responds with auth_ok when valid token is sent', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId, home_zone_id: VALID_ZONE_A, created_at: new Date().toISOString() }] }); // room
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // node positions

    await app.listen({ port: 0 });

    const { socket } = await connectWs(roomId);
    const msgPromise = waitForMessage({ socket } as Awaited<ReturnType<typeof connectWs>>);

    socket.send(JSON.stringify({ type: 'auth', token }));

    const msg = await msgPromise;
    expect((msg as { type: string }).type).toBe('auth_ok');

    socket.close();
  });

  it('sends sync message after auth_ok', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId, home_zone_id: VALID_ZONE_A, created_at: new Date().toISOString() }] }); // room
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // connections
    mockDb.query.mockResolvedValueOnce({ rows: [] }); // node positions

    await app.listen({ port: 0 });

    const { socket } = await connectWs(roomId);
    const messages: unknown[] = [];

    // Collect first two messages
    const collect = new Promise<void>((resolve) => {
      let count = 0;
      socket.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
        count++;
        if (count >= 2) resolve();
      });
    });

    socket.send(JSON.stringify({ type: 'auth', token }));
    await collect;

    expect((messages[0] as { type: string }).type).toBe('auth_ok');
    expect((messages[1] as { type: string; connections: unknown[]; homeZoneId: string }).type).toBe('sync');
    expect(Array.isArray((messages[1] as { connections: unknown[] }).connections)).toBe(true);

    socket.close();
  });

  it('closes with 4401 when invalid token is sent', async () => {
    await app.listen({ port: 0 });

    const { socket } = await connectWs(roomId);

    const closeCode = await new Promise<number>((resolve) => {
      socket.on('close', (code) => resolve(code));
      socket.send(JSON.stringify({ type: 'auth', token: 'invalid.token.here' }));
    });

    expect(closeCode).toBe(4401);
  });

  it('only fans out to clients in the same room', async () => {
    // room 1 sync mocks
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId, home_zone_id: VALID_ZONE_A, created_at: new Date().toISOString() }] });
    mockDb.query.mockResolvedValueOnce({ rows: [] });
    mockDb.query.mockResolvedValueOnce({ rows: [] });

    await app.listen({ port: 0 });

    // Create a second room
    const roomId2 = 'room-2';
    const token2 = app.jwt.sign({ roomId: roomId2 });

    // room 2 sync mocks
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId2, home_zone_id: VALID_ZONE_B, created_at: new Date().toISOString() }] });
    mockDb.query.mockResolvedValueOnce({ rows: [] });
    mockDb.query.mockResolvedValueOnce({ rows: [] });

    const ws1 = await connectWs(roomId);
    const ws2 = await connectWs(roomId2);

    const room1Messages: unknown[] = [];
    const room2Messages: unknown[] = [];

    ws1.socket.on('message', (d) => room1Messages.push(JSON.parse(d.toString())));
    ws2.socket.on('message', (d) => room2Messages.push(JSON.parse(d.toString())));

    // Authenticate both
    ws1.socket.send(JSON.stringify({ type: 'auth', token }));
    ws2.socket.send(JSON.stringify({ type: 'auth', token: token2 }));

    // Wait for auth + sync
    await new Promise((r) => setTimeout(r, 300));

    const beforeCount1 = room1Messages.length;
    const beforeCount2 = room2Messages.length;

    // Post a connection to room 1 only
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: roomId }] }); // room check
    mockDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT connection
    
    await app.inject({
      method: 'POST',
      url: `/api/rooms/${roomId}/connections`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fromZoneId: VALID_ZONE_A, toZoneId: VALID_ZONE_B, minutesRemaining: 30 },
    });

    await new Promise((r) => setTimeout(r, 100));

    // Room 1 client should get connection_added
    const newRoom1 = room1Messages.slice(beforeCount1);
    expect(newRoom1.some((m) => (m as { type: string }).type === 'connection_added')).toBe(true);

    // Room 2 client should NOT get it
    const newRoom2 = room2Messages.slice(beforeCount2);
    expect(newRoom2.some((m) => (m as { type: string }).type === 'connection_added')).toBe(false);

    ws1.close();
    ws2.close();
  });
});
