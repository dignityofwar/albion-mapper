import mapsData from '../data/maps.json' with { type: 'json' };
import type { GameMap, Zone } from './types.js';

const isRoadsHome = (name: string) => /^[^-\s]+-[^-\s]+-[^-\s]+$/.test(name);

export const ZONES: Zone[] = (mapsData as GameMap[]).map((m) => {
  const zone: Zone = {
    id: m.mapID,
    name: m.mapName,
    type: m.mapType,
    tier: m.tier,
    ores: m.oresAvailable,
  };

  if (m.mapType === 'roads' || m.mapType === 'roadsHideout') {
    zone.isRoadsHome = m.mapType === 'roadsHideout' || isRoadsHome(m.mapName);
  }

  return zone;
});

export const ZONE_BY_ID = new Map(ZONES.map((z) => [z.id, z]));
