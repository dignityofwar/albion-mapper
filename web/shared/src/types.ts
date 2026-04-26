import { z } from 'zod';

// ── Zone types ──────────────────────────────────────────────────────────────

export type ZoneType = 'royalBlue' | 'royalYellow' | 'royalRed' | 'outlands' | 'roads' | 'roadsHideout' | 'other';

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  tier: number;
  ores?: string[];
  isRoadsHome?: boolean;
}

// ── GameMap (on-disk shape from maps.json) ──────────────────────────────────

export type MapType = 'royalBlue' | 'royalYellow' | 'royalRed' | 'outlands' | 'roads' | 'roadsHideout' | 'other';

export interface GameMap {
  mapID: string;
  mapName: string;
  mapType: MapType;
  tier: number;
  oresAvailable?: string[];
}

// ── Connection ───────────────────────────────────────────────────────────────

export interface Connection {
  id: string;
  roomId: string;
  fromZoneId: string;
  toZoneId: string;
  expiresAt: string;
  reportedAt: string;
  reportedBy?: string;
  isExpired?: boolean;
}

export interface NodePosition {
  zoneId: string;
  x: number;
  y: number;
}

export type ConnectionStatus = 'active' | 'stale' | 'expired';

export function getConnectionStatus(connection: Connection, now: Date = new Date()): ConnectionStatus {
  const expiresAt = new Date(connection.expiresAt).getTime();
  const nowMs = now.getTime();
  const staleUntil = expiresAt + 6 * 60 * 60 * 1000;

  if (nowMs < expiresAt) return 'active';
  if (nowMs < staleUntil) return 'stale';
  return 'expired';
}

// ── Room ─────────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  passwordHash: string;
  homeZoneId: string;
  createdAt: string;
}

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const ZoneTypeSchema = z.enum([
  'royalBlue',
  'royalYellow',
  'royalRed',
  'outlands',
  'roads',
  'roadsHideout',
  'other',
]);

export const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ZoneTypeSchema,
  tier: z.number().int().min(1).max(8),
  ores: z.array(z.string()).optional(),
  isRoadsHome: z.boolean().optional(),
});

export const ConnectionSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string(),
  fromZoneId: z.string(),
  toZoneId: z.string(),
  expiresAt: z.string().datetime(),
  reportedAt: z.string().datetime(),
  reportedBy: z.string().optional(),
});

export const RoomSchema = z.object({
  id: z.string(),
  passwordHash: z.string(),
  homeZoneId: z.string(),
  createdAt: z.string().datetime(),
});

// ── API request schemas ───────────────────────────────────────────────────────

export const CreateRoomBodySchema = z.object({
  password: z.string().min(1),
  homeZoneId: z.string().min(1),
});

export const AuthRoomBodySchema = z.object({
  password: z.string().min(1),
});

export const CreateConnectionBodySchema = z.object({
  fromZoneId: z.string().min(1),
  toZoneId: z.string().min(1),
  minutesRemaining: z.number().int().min(1).max(360),
  reportedBy: z.string().optional(),
});

export const UpdateRoomBodySchema = z.object({
  homeZoneId: z.string().min(1),
});
export const ChangePasswordBodySchema = z.object({
  newPassword: z.string().min(1),
});

// ── WebSocket message types ───────────────────────────────────────────────────

export type ServerMessage =
  | { type: 'auth_ok' }
  | { type: 'sync'; connections: Connection[]; homeZoneId: string; nodePositions: NodePosition[] }
  | { type: 'connection_added'; connection: Connection }
  | { type: 'connection_removed'; connectionId: string }
  | { type: 'connection_expired'; connectionId: string }
  | { type: 'room_updated'; homeZoneId: string }
  | { type: 'room_reset' }
  | { type: 'node_positions_updated'; nodePositions: NodePosition[] }
  | { type: 'error'; message: string };

export type ClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'ping' }
  | { type: 'update_node_positions'; nodePositions: NodePosition[] };
