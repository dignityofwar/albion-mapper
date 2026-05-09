import type { WebSocket } from '@fastify/websocket';
import { broadcast, getAllRoomSockets, getTotalSocketCount } from './broadcast.js';

// Single global marco interval
let globalMarcoInterval: ReturnType<typeof setInterval> | null = null;

// Set of sockets that have responded with polo in the current cycle
let poloResponders = new Set<WebSocket>();

// Whether a polo collection window is currently open
let collectTimeout: ReturnType<typeof setTimeout> | null = null;

const MARCO_INTERVAL_MS = 15_000;
const POLO_COLLECT_MS = 5_000;

export function ensureMarcoStarted(): void {
  if (globalMarcoInterval !== null) return;
  globalMarcoInterval = setInterval(() => {
    triggerMarcoCycle();
  }, MARCO_INTERVAL_MS);
}

export function stopMarcoIfEmpty(): void {
  if (getTotalSocketCount() === 0 && globalMarcoInterval !== null) {
    clearInterval(globalMarcoInterval);
    globalMarcoInterval = null;
    if (collectTimeout) {
      clearTimeout(collectTimeout);
      collectTimeout = null;
    }
    poloResponders = new Set();
  }
}

export function recordPolo(ws: WebSocket): void {
  poloResponders.add(ws);
}

export function triggerMarcoCycle(): void {
  if (getTotalSocketCount() === 0) return;

  // Cancel any in-progress collect window
  if (collectTimeout) {
    clearTimeout(collectTimeout);
    collectTimeout = null;
  }

  poloResponders = new Set();

  // Broadcast marco to all sockets across all rooms
  const allRoomSockets = getAllRoomSockets();
  const marcoPayload = JSON.stringify({ type: 'marco' });
  for (const [, sockets] of allRoomSockets) {
    for (const ws of sockets) {
      if (ws.readyState === ws.OPEN) {
        ws.send(marcoPayload);
      }
    }
  }

  collectTimeout = setTimeout(() => {
    collectTimeout = null;

    // Drop sockets that didn't respond
    const allRooms = getAllRoomSockets();
    for (const [, sockets] of allRooms) {
      for (const ws of sockets) {
        if (!poloResponders.has(ws) && ws.readyState === ws.OPEN) {
          ws.close(1001, 'No polo response — connection assumed dead');
        }
      }
    }

    // Broadcast per-room watching counts (only responders in each room)
    const totalConnected = getTotalSocketCount();
    for (const [roomId, sockets] of allRooms) {
      const count = [...sockets].filter(ws => poloResponders.has(ws)).length;
      broadcast(roomId, { type: 'watching', roomId, count, totalConnected });
    }

    poloResponders = new Set();
  }, POLO_COLLECT_MS);
}

export function getWatchingCount(roomId: string): number {
  // Returns how many sockets in the room responded in the last cycle
  // Before first cycle completes, fall back to raw socket count
  const allRooms = getAllRoomSockets();
  const sockets = allRooms.get(roomId);
  if (!sockets) return 0;
  // If no cycle has run yet, return socket count as best estimate
  return sockets.size;
}
