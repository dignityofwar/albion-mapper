import type { ZoneType } from 'shared';
import { ZONE_TYPE_CLASSES } from './colors';
import { Position } from '@vue-flow/core';

export const TYPE_LABELS: Record<ZoneType, string> = {
  royalBlue: 'Royal Continent',
  royalYellow: 'Royal Continent',
  royalRed: 'Royal Continent',
  outlands: 'Outlands',
  roads: 'Roads',
  roadsHideout: 'Roads Hideout',
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

export function getBorderBgClass(type: string): string {
  switch (type) {
    case 'royalBlue': return 'bg-blue-500';
    case 'royalYellow': return 'bg-yellow-500';
    case 'royalRed': return 'bg-red-500';
    case 'outlands': return 'bg-[#1f1f1f]';
    case 'roads':
    case 'roadsHideout': return 'bg-gray-500';
    default: return 'bg-gray-500';
  }
}

export function getHandlePosition(left: string, top: string): Position {
  const l = parseFloat(left);
  const t = parseFloat(top);
  
  // Points
  if (Math.abs(l - 50) < 0.1 && Math.abs(t - 0) < 0.1) return Position.Top;
  if (Math.abs(l - 100) < 0.1 && Math.abs(t - 50) < 0.1) return Position.Right;
  if (Math.abs(l - 50) < 0.1 && Math.abs(t - 100) < 0.1) return Position.Bottom;
  if (Math.abs(l - 0) < 0.1 && Math.abs(t - 50) < 0.1) return Position.Left;

  // Diagonals
  if (l > 50 && t < 50) return Position.Top;
  if (l > 50 && t > 50) return Position.Right;
  if (l < 50 && t > 50) return Position.Bottom;
  return Position.Left;
}
