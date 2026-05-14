import { z } from 'zod';

// ── Zone types ──────────────────────────────────────────────────────────────

export type ZoneType = 'royalBlue' | 'royalYellow' | 'royalRed' | 'outlands' | 'roads' | 'roadsHideout' | 'other';

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  tier: number;
  knownFeatures?: KnownFeatures;
  isRoadsHome?: boolean;
  category?: string;
  mapShape?: string;
  proximityTo?: string;
}

// ── GameMap (on-disk shape from maps.json) ──────────────────────────────────

export type MapType = 'royalBlue' | 'royalYellow' | 'royalRed' | 'outlands' | 'roads' | 'other';

export type KnownFeatures = string[];

export interface GameMap {
  mapID: string;
  mapName: string;
  mapType: MapType;
  tier: number;
  category?: string;
  isRoadsHideout?: true;
  knownFeatures?: KnownFeatures;
  mapShape?: string;
  socketCount?: number;
  largeSocketCount?: number;
  smallSocketCount?: number;
  proximityTo?: string;
}

// ── Connection ───────────────────────────────────────────────────────────────

export interface HandleCoordinates {
  position: { x: number; y: number };
}

export interface Connection {
  id: string;
  roomId: string;
  fromZoneId: string;
  toZoneId: string;
  fromHandleId?: string;
  toHandleId?: string;
  expiresAt: string;
  reportedAt: string;
  reportedBy?: string;
  isExpired?: boolean;
  startHandle?: HandleCoordinates;
  endHandle?: HandleCoordinates;
}

export interface NodePosition {
  zoneId: string;
  x: number;
  y: number;
  virtualGridPos?: { x: number; y: number };
  features?: NodeFeatures;
  customHandles?: CustomHandle[];
  proximityTo?: string;
  explored?: boolean;
}

export interface CustomHandle {
  id: string;
  left: string;
  top: string;
  disabled?: boolean;
  position?: 'top' | 'right' | 'bottom' | 'left';
}

export type ResourceType = 'fibre' | 'leather' | 'ore' | 'stone' | 'wood';

export interface ResourceEntry {
  type: ResourceType;
  small?: number;
  large?: number;
}

export interface TimedChest {
  size: 'S' | 'M' | 'L';
  timer: number; // Expiration timestamp in ms
}

export interface NodeFeatures {
  slots?: 7 | 20;
  reds?: number | null;
  redsTimer?: number; // Expiration timestamp in ms
  powercoreBlue?: boolean;
  powercorePurple?: boolean;
  powercoreGreen?: boolean;
  powercoreYellow?: boolean;
  powercoreTimerGreen?: number; // Expiration timestamp in ms
  powercoreTimerBlue?: number;  // Expiration timestamp in ms
  powercoreTimerPurple?: number; // Expiration timestamp in ms
  powercoreTimerYellow?: number; // Expiration timestamp in ms
  crystalCreaturePresent?: boolean;
  dungeonStatic?: boolean;
  dungeonGroup?: boolean;
  timedChest?: TimedChest;
  treasuresGreenCount?: number;
  treasuresBlueCount?: number;
  treasuresYellowCount?: number;
  dungeonStaticCount?: number;
  dungeonGroupCount?: number;
  resources?: ResourceEntry[];
  upstreamFeatures?: string[]; // Feature keys/resource types populated from upstream maps.json data (unconfirmed)
  lastUpdatedAt?: number; // Timestamp in ms
}

export type ConnectionStatus = 'active' | 'expired';

export function getConnectionStatus(connection: Connection, now: Date = new Date()): ConnectionStatus {
  const expiresAt = new Date(connection.expiresAt).getTime();
  const nowMs = now.getTime();

  if (nowMs < expiresAt) return 'active';
  return 'expired';
}

// ── Room Memory ──────────────────────────────────────────────────────────────

export interface RoomMemoryEntry {
  zoneId: string;
  timesAdded: string[]; // ISO date strings
  features?: NodeFeatures;
  customHandles?: CustomHandle[];
  lastUpdated: string; // ISO date string
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
  plottedRoute?: string[];
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
  knownResources: z.array(z.string()).optional(),
  isRoadsHome: z.boolean().optional(),
  category: z.string().optional(),
});

export const ConnectionSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string(),
  fromZoneId: z.string(),
  toZoneId: z.string(),
  fromHandleId: z.string().optional(),
  toHandleId: z.string().optional(),
  expiresAt: z.string().datetime(),
  reportedAt: z.string().datetime(),
  reportedBy: z.string().optional(),
  startHandle: z.object({
    position: z.object({ x: z.number(), y: z.number() }),
  }).optional(),
  endHandle: z.object({
    position: z.object({ x: z.number(), y: z.number() }),
  }).optional(),
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
  vanityUrl: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export const AuthRoomBodySchema = z.object({
  password: z.string().min(1),
});

export const CreateConnectionBodySchema = z.object({
  fromZoneId: z.string().min(1),
  toZoneId: z.string().min(1),
  fromHandleId: z.string().nullable().optional(),
  toHandleId: z.string().nullable().optional(),
  secondsRemaining: z.number().int().min(1).max(86400),
  slots: z.union([z.literal(7), z.literal(20)], {
    errorMap: () => ({ message: 'slots is required and must be 7 or 20' }),
  }),
  reportedBy: z.string().optional(),
  targetPosition: z.object({ x: z.number(), y: z.number() }).optional(),
});

export const UpdateConnectionBodySchema = z.object({
  secondsRemaining: z.number().int().min(1).max(86400).optional(),
  fromHandleId: z.string().nullable().optional(),
  toHandleId: z.string().nullable().optional(),
});

export const ChangePasswordBodySchema = z.object({
  newPassword: z.string().min(1),
  adminPassword: z.string().min(1),
});

export const ResourceEntrySchema = z.object({
  type: z.enum(['fibre', 'leather', 'ore', 'stone', 'wood']),
  small: z.number().optional(),
  large: z.number().optional(),
});

export const NodeFeaturesSchema = z.object({
  slots: z.union([z.literal(7), z.literal(20)]).optional(),
  reds: z.number().nullable().optional(),
  redsTimer: z.number().optional(),
  powercoreBlue: z.boolean().optional(),
  powercorePurple: z.boolean().optional(),
  powercoreGreen: z.boolean().optional(),
  powercoreYellow: z.boolean().optional(),
  powercoreTimerGreen: z.number().optional(),
  powercoreTimerBlue: z.number().optional(),
  powercoreTimerPurple: z.number().optional(),
  powercoreTimerYellow: z.number().optional(),
  crystalCreaturePresent: z.boolean().optional(),
  dungeonStatic: z.boolean().optional(),
  dungeonGroup: z.boolean().optional(),
  timedChest: z.object({
    size: z.enum(['S', 'M', 'L']),
    timer: z.number(),
  }).optional(),
  treasuresGreenCount: z.number().optional(),
  treasuresBlueCount: z.number().optional(),
  treasuresYellowCount: z.number().optional(),
  dungeonStaticCount: z.number().optional(),
  dungeonGroupCount: z.number().optional(),
  resources: z.array(ResourceEntrySchema).optional(),
}).passthrough().optional();

export const CustomHandleSchema = z.object({
  id: z.string(),
  left: z.string(),
  top: z.string(),
  disabled: z.boolean().optional(),
});

export const NodePositionSchema = z.object({
  zoneId: z.string(),
  x: z.number(),
  y: z.number(),
  virtualGridPos: z.object({ x: z.number(), y: z.number() }).optional(),
  features: NodeFeaturesSchema.optional(),
  customHandles: z.array(CustomHandleSchema).nullable().optional(),
  explored: z.boolean().optional(),
});

export const RoomMemoryEntrySchema = z.object({
  zoneId: z.string(),
  timesAdded: z.array(z.string()),
  features: NodeFeaturesSchema.optional(),
  customHandles: z.array(CustomHandleSchema).nullable().optional(),
  lastUpdated: z.string(),
});

export const ImportRoomBodySchema = z.object({
  homeZoneId: z.string(),
  connections: z.array(z.object({
      id: z.string().optional(),
      roomId: z.string().optional(),
      fromZoneId: z.string(),
      toZoneId: z.string(),
      fromHandleId: z.string().nullable().optional(),
      toHandleId: z.string().nullable().optional(),
      expiresAt: z.string().datetime(),
      reportedAt: z.string().datetime().optional(),
      reportedBy: z.string().optional(),
  })),
  nodePositions: z.array(NodePositionSchema),
  roomHistory: z.array(RoomMemoryEntrySchema).optional(),
});

// ── WebSocket message types ───────────────────────────────────────────────────

export type ServerMessage =
  | { type: 'auth_ok' }
  | { type: 'sync'; connections: Connection[]; homeZoneId: string; title?: string; nodePositions: NodePosition[]; lastUpdatedAt: string; watching: number; totalConnected: number; plottedRoute?: string[] }
  | { type: 'connection_added'; connection: Connection }
  | { type: 'connection_updated'; connection: Connection }
  | { type: 'connection_removed'; connectionId: string }
  | { type: 'connection_expired'; connectionId: string }
  | { type: 'room_updated'; homeZoneId: string }
  | { type: 'room_reset' }
  | { type: 'node_positions_updated'; nodePositions: NodePosition[]; updateLastUpdated?: boolean }
  | { type: 'ping'; zoneName: string; nodeId?: string }
  | { type: 'marco' }
  | { type: 'watching'; roomId: string; count: number; totalConnected: number }
  | { type: 'memory_sync'; memory: RoomMemoryEntry[] }
  | { type: 'memory_updated'; entry: RoomMemoryEntry }
  | { type: 'memory_deleted'; zoneId: string }
  | { type: 'plot_route_updated'; plottedRoute: string[]; destinationZoneId?: string }
  | { type: 'error'; message: string };

export type ClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'ping'; zoneName: string; nodeId?: string }
  | { type: 'polo' }
  | { type: 'update_node_positions'; nodePositions: NodePosition[]; updateLastUpdated?: boolean }
  | { type: 'update_plot_route'; plottedRoute: string[]; destinationZoneId?: string };
