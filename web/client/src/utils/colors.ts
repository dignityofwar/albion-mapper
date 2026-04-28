import type { ZoneType } from 'shared';

export const ZONE_TYPE_CLASSES: Record<ZoneType, string> = {
  royalBlue: 'bg-gray-600',
  royalYellow: 'bg-gray-600',
  royalRed: 'bg-gray-600',
  outlands: 'bg-gray-600',
  roads: 'bg-gray-600',
  roadsHideout: 'bg-gray-600',
  other: 'bg-gray-600',
};

export const getTierClasses = (zoneType: ZoneType): string => {
  if (zoneType === 'royalBlue') return 'bg-blue-700';
  if (zoneType === 'royalYellow') return 'bg-yellow-700';
  if (zoneType === 'royalRed') return 'bg-red-700';
  if (zoneType === 'outlands' || zoneType === 'roads' || zoneType === 'roadsHideout') return 'bg-[#1f1f1f] border border-gray-500';

  return 'bg-gray-700';
};

