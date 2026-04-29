import type { ZoneType } from 'shared';
import { ZONE_TYPE_CLASSES } from './colors';

export const TYPE_LABELS: Record<ZoneType, string> = {
  royalBlue: 'Royal Continent',
  royalYellow: 'Royal Continent',
  royalRed: 'Royal Continent',
  outlands: 'Outlands',
  roads: 'Roads',
  other: 'Other / Outlands',
};

export function getZoneTypeDisplay(type: ZoneType, mapShape?: string) {
  let label = TYPE_LABELS[type];

  if (type === 'roads' && mapShape) {
    if (mapShape === 'rest') {
      label = 'Roads - Hideout';
    } else if (mapShape !== 'unknown') {
      label = `Roads - ${mapShape.toUpperCase()} shape`;
    }
  }

  return {
    label,
    class: ZONE_TYPE_CLASSES[type],
  };
}
