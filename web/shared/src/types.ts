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
  category?: string;
}

// ── GameMap (on-disk shape from maps.json) ──────────────────────────────────

export type MapType = 'royalBlue' | 'royalYellow' | 'royalRed' | 'outlands' | 'roads' | 'roadsHideout' | 'other';

export interface GameMap {
  mapID: string;
  mapName: string;
  mapType: MapType;
  tier: number;
  category?: string;
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
  virtualGridPos?: { x: number; y: number };
  features?: NodeFeatures;
}

export interface NodeFeatures {
  reds?: number | null;
  redsTimer?: number; // Expiration timestamp in ms
  powercoreBlue?: boolean;
  powercorePurple?: boolean;
  powercoreGreen?: boolean;
  powercoreTimerGreen?: number; // Expiration timestamp in ms
  powercoreTimerBlue?: number;  // Expiration timestamp in ms
  powercoreTimerPurple?: number; // Expiration timestamp in ms
  crystalCreaturePresent?: boolean;
  dungeonStatic?: boolean;
  dungeonGroup?: boolean;
  chest?: boolean;
  treasuresGreen?: boolean;
  treasuresBlue?: boolean;
  treasuresYellow?: boolean;
  resourceFibre?: boolean;
  resourceLeather?: boolean;
  resourceOre?: boolean;
  resourceStone?: boolean;
  resourceWood?: boolean;
}

export type ConnectionStatus = 'active' | 'expired';

export function getConnectionStatus(connection: Connection, now: Date = new Date()): ConnectionStatus {
  const expiresAt = new Date(connection.expiresAt).getTime();
  const nowMs = now.getTime();

  if (nowMs < expiresAt) return 'active';
  return 'expired';
}

// ── Room ─────────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  title?: string;
  passwordHash: string;
  adminPasswordHash: string;
  homeZoneId: string;
  createdAt: string;
  updatedAt?: string;
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
  category: z.string().optional(),
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
  title: z.string().max(50).optional(),
  passwordHash: z.string(),
  adminPasswordHash: z.string(),
  homeZoneId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

// ── API request schemas ───────────────────────────────────────────────────────

export const CreateRoomBodySchema = z.object({
  password: z.string().min(1),
  adminPassword: z.string().min(1),
  homeZoneId: z.string().min(1),
  title: z.string().max(50).optional(),
});

export const AuthRoomBodySchema = z.object({
  password: z.string().min(1),
});

export const CreateConnectionBodySchema = z.object({
  fromZoneId: z.string().min(1),
  toZoneId: z.string().min(1),
  secondsRemaining: z.number().int().min(1).max(86400),
  reportedBy: z.string().optional(),
});

export const UpdateConnectionBodySchema = z.object({
  secondsRemaining: z.number().int().min(1).max(86400),
});

export const ChangePasswordBodySchema = z.object({
  newPassword: z.string().min(1),
  adminPassword: z.string().min(1),
});

// ── WebSocket message types ───────────────────────────────────────────────────

export type ServerMessage =
  | { type: 'auth_ok' }
  | { type: 'sync'; connections: Connection[]; homeZoneId: string; title?: string; nodePositions: NodePosition[]; lastUpdatedAt: string }
  | { type: 'connection_added'; connection: Connection }
  | { type: 'connection_updated'; connection: Connection }
  | { type: 'connection_removed'; connectionId: string }
  | { type: 'connection_expired'; connectionId: string }
  | { type: 'room_updated'; homeZoneId: string }
  | { type: 'room_reset' }
  | { type: 'node_positions_updated'; nodePositions: NodePosition[]; updateLastUpdated?: boolean }
  | { type: 'error'; message: string };

export type ClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'ping' }
  | { type: 'update_node_positions'; nodePositions: NodePosition[]; updateLastUpdated?: boolean };
