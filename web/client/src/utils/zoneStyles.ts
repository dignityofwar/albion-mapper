import type { ZoneType } from 'shared';
import { ZONE_TYPE_CLASSES } from './colors';

export const TYPE_LABELS: Record<ZoneType, string> = {
  royalBlue: 'Royal Continent',
  royalYellow: 'Royal Continent',
  royalRed: 'Royal Continent',
  outlands: 'Outlands',
  roads: 'Roads',
  roadsHideout: 'Roads (Hideout)',
  other: 'Other / Outlands',
};

export function getZoneTypeDisplay(type: ZoneType) {
  return {
    label: TYPE_LABELS[type],
    class: ZONE_TYPE_CLASSES[type],
  };
}
