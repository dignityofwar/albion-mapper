import type { ZoneType } from 'shared';

export const ZONE_TYPE_CLASSES: Record<ZoneType, string> = {
  royalBlue: 'bg-blue-800 border border-blue-400',
  royalYellow: 'bg-yellow-700/60 border border-yellow-400',
  royalRed: 'bg-red-900/70 border border-red-500',
  outlands: 'bg-gray-600',
  roads: 'bg-gray-600',
  roadsHideout: 'bg-gray-600',
  other: 'bg-blue-800 border border-blue-400',
};

export const getTierClasses = (zoneType: ZoneType): string => {
  if (zoneType === 'royalBlue' || zoneType === 'other') return 'bg-blue-800 border border-blue-400';
  if (zoneType === 'royalYellow') return 'bg-yellow-700/60 border border-yellow-400';
  if (zoneType === 'royalRed') return 'bg-red-900/70 border border-red-500';
  if (zoneType === 'outlands' || zoneType === 'roads' || zoneType === 'roadsHideout') return 'bg-[#1f1f1f] border border-gray-500';

  return 'bg-gray-700';
};

