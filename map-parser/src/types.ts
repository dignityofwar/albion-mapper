import { z } from 'zod';

export type MapType =
  | 'royalBlue'
  | 'royalYellow'
  | 'royalRed'
  | 'outlands'
  | 'roads'
  | 'other';

export interface GameMap {
  mapID: string;
  mapName: string;
  mapType: MapType;
  tier: number;
  category?: string;
  isRoadsHideout?: true;
  oresAvailable?: string[];
}

export const MapTypeSchema = z.enum([
  'royalBlue',
  'royalYellow',
  'royalRed',
  'outlands',
  'roads',
  'other',
]);

export const GameMapSchema = z.object({
  mapID: z.string(),
  mapName: z.string(),
  mapType: MapTypeSchema,
  tier: z.number().int().min(1).max(8),
  category: z.string().optional(),
  isRoadsHideout: z.literal(true).optional(),
  oresAvailable: z.array(z.string()).optional(),
});
