import { z } from 'zod';

export type MapType =
  | 'royalBlue'
  | 'royalYellow'
  | 'royalRed'
  | 'outlands'
  | 'roads'
  | 'other';

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
}

export const MapTypeSchema = z.enum([
  'royalBlue',
  'royalYellow',
  'royalRed',
  'outlands',
  'roads',
  'other',
]);

export const KnownFeaturesSchema = z.array(z.string());

export const GameMapSchema = z.object({
  mapID: z.string(),
  mapName: z.string(),
  mapType: MapTypeSchema,
  tier: z.number().int().min(1).max(8),
  category: z.string().optional(),
  isRoadsHideout: z.literal(true).optional(),
  knownFeatures: KnownFeaturesSchema.optional(),
  mapShape: z.string().optional(),
  socketCount: z.number().int().nonnegative().optional(),
  largeSocketCount: z.number().int().nonnegative().optional(),
  smallSocketCount: z.number().int().nonnegative().optional(),
});
