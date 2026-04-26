import type { WebSocket } from '@fastify/websocket';
import type { ServerMessage } from 'shared';

// Map of roomId → Set of authenticated WebSocket clients
const roomSockets = new Map<string, Set<WebSocket>>();

export function addSocket(roomId: string, ws: WebSocket): void {
  if (!roomSockets.has(roomId)) {
    roomSockets.set(roomId, new Set());
  }
  roomSockets.get(roomId)!.add(ws);
}

export function removeSocket(roomId: string, ws: WebSocket): void {
  const sockets = roomSockets.get(roomId);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) {
      roomSockets.delete(roomId);
    }
  }
}

export function broadcast(roomId: string, message: ServerMessage, exclude?: WebSocket): void {
  const sockets = roomSockets.get(roomId);
  if (!sockets) return;

  const payload = JSON.stringify(message);
  for (const ws of sockets) {
    if (ws !== exclude && ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }
}

export function getRoomSocketCount(roomId: string): number {
  return roomSockets.get(roomId)?.size ?? 0;
}
