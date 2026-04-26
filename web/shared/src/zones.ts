import mapsData from '../data/maps.json' assert { type: 'json' };
import type { GameMap, Zone } from './types.js';

const isRoadsHome = (name: string) => /^[^-\s]+-[^-\s]+-[^-\s]+$/.test(name);

export const ZONES: Zone[] = (mapsData as GameMap[]).map((m) => ({
  id: m.mapID,
  name: m.mapName,
  type: m.mapType,
  tier: m.tier,
  ores: m.oresAvailable,
  isRoadsHome: m.mapType === 'roads' ? isRoadsHome(m.mapName) : undefined,
}));

export const ZONE_BY_ID = new Map(ZONES.map((z) => [z.id, z]));
