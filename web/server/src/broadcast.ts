import type { WebSocket } from '@fastify/websocket';
import type { ServerMessage } from 'shared';
import { ensureMarcoStarted, stopMarcoIfEmpty } from './marcopolo.js';

// Map of roomId → Set of authenticated WebSocket clients
const roomSockets = new Map<string, Set<WebSocket>>();

export function addSocket(roomId: string, ws: WebSocket): void {
  if (!roomSockets.has(roomId)) {
    roomSockets.set(roomId, new Set());
  }
  roomSockets.get(roomId)!.add(ws);
  ensureMarcoStarted();
  // Broadcast updated counts to all other clients immediately
  const count = roomSockets.get(roomId)!.size;
  const totalConnected = getTotalSocketCount();
  broadcast(roomId, { type: 'watching', roomId, count, totalConnected }, ws);
  broadcastAll({ type: 'watching', roomId, count, totalConnected }, ws);
}

export function removeSocket(roomId: string, ws: WebSocket): void {
  const sockets = roomSockets.get(roomId);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) {
      roomSockets.delete(roomId);
    } else {
      // Broadcast updated counts to remaining clients immediately
      const count = sockets.size;
      const totalConnected = getTotalSocketCount();
      broadcastAll({ type: 'watching', roomId, count, totalConnected });
    }
  }
  stopMarcoIfEmpty();
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

export function broadcastAll(message: ServerMessage, exclude?: WebSocket): void {
  const payload = JSON.stringify(message);
  for (const sockets of roomSockets.values()) {
    for (const ws of sockets) {
      if (ws !== exclude && ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    }
  }
}

export function getRoomSocketCount(roomId: string): number {
  return roomSockets.get(roomId)?.size ?? 0;
}

export function getTotalSocketCount(): number {
  let total = 0;
  for (const sockets of roomSockets.values()) {
    total += sockets.size;
  }
  return total;
}

export function getAllRoomSockets(): Map<string, Set<WebSocket>> {
  return roomSockets;
}
