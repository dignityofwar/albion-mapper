import { z } from 'zod';

export type MapType =
  | 'royalBlue'
  | 'royalYellow'
  | 'royalRed'
  | 'outlands'
  | 'roads'
  | 'other';

export interface GuaranteedContent {
  type: string;
  category: string;
}

export interface GameMap {
  mapID: string;
  mapName: string;
  mapType: MapType;
  tier: number;
  category?: string;
  isRoadsHideout?: true;
  oresAvailable?: string[];
  mapShape?: string;
  socketCount?: number;
  largeSocketCount?: number;
  smallSocketCount?: number;
  socketCountIsMinimum?: boolean;
  guaranteedContent?: GuaranteedContent | null;
}

export const MapTypeSchema = z.enum([
  'royalBlue',
  'royalYellow',
  'royalRed',
  'outlands',
  'roads',
  'other',
]);

export const GuaranteedContentSchema = z.object({
  type: z.string(),
  category: z.string(),
});

export const GameMapSchema = z.object({
  mapID: z.string(),
  mapName: z.string(),
  mapType: MapTypeSchema,
  tier: z.number().int().min(1).max(8),
  category: z.string().optional(),
  isRoadsHideout: z.literal(true).optional(),
  oresAvailable: z.array(z.string()).optional(),
  mapShape: z.string().optional(),
  socketCount: z.number().int().nonnegative().optional(),
  largeSocketCount: z.number().int().nonnegative().optional(),
  smallSocketCount: z.number().int().nonnegative().optional(),
  socketCountIsMinimum: z.boolean().optional(),
  guaranteedContent: GuaranteedContentSchema.nullable().optional(),
});
