import mapsData from '../data/maps.json' with { type: 'json' };
import type { GameMap, Zone, CustomHandle, ZoneType } from './types.js';

export function getDefaultHandles(shape?: string): CustomHandle[] {
  if (shape === 'c') {
    return [
      { id: 'c-p1', left: '33.79%', top: '16.21%' },
      { id: 'c-p2', left: '7.62%', top: '42.38%' },
      { id: 'c-p3', left: '16.99%', top: '66.99%' },
      { id: 'c-p4', left: '36.52%', top: '86.52%' },
      { id: 'c-p5', left: '67.38%', top: '82.62%' },
      { id: 'c-p6', left: '89.65%', top: '60.35%' },
    ];
  }
  if (shape === 'f') {
    return [
      { id: 'f-p1', left: '45.12%', top: '4.88%' },
      { id: 'f-p2', left: '27.93%', top: '22.07%' },
      { id: 'f-p3', left: '8.40%', top: '58.40%' },
      { id: 'f-p4', left: '31.05%', top: '81.05%' },
      { id: 'f-p5', left: '61.13%', top: '88.87%' },
      { id: 'f-p6', left: '84.18%', top: '34.18%' },
    ];
  }

  if (shape === 'h') {
    return [
      { id: 'h-p1', left: '64.26%', top: '14.26%' },
      { id: 'h-p2', left: '15.82%', top: '65.82%' },
      { id: 'h-p3', left: '24.80%', top: '25.20%' },
      { id: 'h-p4', left: '36.91%', top: '86.91%' },
      { id: 'h-p5', left: '75.59%', top: '74.41%' },
      { id: 'h-p6', left: '85.74%', top: '35.74%' },
    ];
  }

  if (shape === 'o') {
    return [
      { id: 'o-p1', left: '44.34%', top: '5.66%' },
      { id: 'o-p2', left: '8.40%', top: '41.60%' },
      { id: 'o-p3', left: '17.38%', top: '67.38%' },
      { id: 'o-p4', left: '58.01%', top: '91.99%' },
      { id: 'o-p5', left: '91.21%', top: '58.79%' },
      { id: 'o-p6', left: '83.40%', top: '33.40%' },
    ];
  }

  if (shape === 'p') {
    return [
      { id: 'p-p1', left: '54.88%', top: '4.88%' },
      { id: 'p-p2', left: '73.63%', top: '23.63%' },
      { id: 'p-p3', left: '63.09%', top: '86.91%' },
      { id: 'p-p4', left: '27.15%', top: '77.15%' },
      { id: 'p-p5', left: '7.23%', top: '57.23%' },
      { id: 'p-p6', left: '25.98%', top: '24.02%' },
    ];
  }

  if (shape === 's') {
    return [
      { id: 's-p1', left: '64.45%', top: '14.45%' },
      { id: 's-p2', left: '19.53%', top: '30.47%' },
      { id: 's-p3', left: '87.89%', top: '37.89%' },
      { id: 's-p4', left: '77.73%', top: '72.27%' },
      { id: 's-p5', left: '46.48%', top: '96.48%' },
    ];
  }

  if (shape === 't') {
    return [
      { id: 't-p1', left: '27.93%', top: '77.93%' },
      { id: 't-p2', left: '6.84%', top: '56.84%' },
      { id: 't-p3', left: '53.71%', top: '96.29%' },
      { id: 't-p4', left: '27.93%', top: '77.93%' },
      { id: 't-p5', left: '21.68%', top: '28.32%' },
      { id: 't-p6', left: '88.87%', top: '61.13%' },
      { id: 't-p7', left: '79.88%', top: '29.88%' },
    ];
  }

  if (shape === 'x') {
    return [
      { id: 'x-p1', left: '26.56%', top: '23.44%' },
      { id: 'x-p2', left: '23.83%', top: '73.83%' },
      { id: 'x-p3', left: '36.33%', top: '86.33%' },
      { id: 'x-p4', left: '78.52%', top: '71.48%' },
      { id: 'x-p5', left: '78.13%', top: '28.13%' },
      { id: 'x-p6', left: '67.19%', top: '17.19%' },
    ];
  }

  // Default 4 corners for others
  return [
    { id: 'top', left: '50%', top: '0%' },
    { id: 'right', left: '100%', top: '50%' },
    { id: 'bottom', left: '50%', top: '100%' },
    { id: 'left', left: '0%', top: '50%' },
  ];
}

export const DEFAULT_INTERNAL_HANDLES: CustomHandle[] = [
  { id: 'default-nw', left: '25%', top: '25%' },
  { id: 'default-ne', left: '75%', top: '25%' },
  { id: 'default-se', left: '75%', top: '75%' },
  { id: 'default-sw', left: '25%', top: '75%' },
];

export function getHandleFacing(left: string, top: string): string {
  const l = parseFloat(left);
  const t = parseFloat(top);
  
  // Points
  if (Math.abs(l - 50) < 0.1 && Math.abs(t - 0) < 0.1) return 'n';
  if (Math.abs(l - 100) < 0.1 && Math.abs(t - 50) < 0.1) return 'e';
  if (Math.abs(l - 50) < 0.1 && Math.abs(t - 100) < 0.1) return 's';
  if (Math.abs(l - 0) < 0.1 && Math.abs(t - 50) < 0.1) return 'w';

  // Sides
  if (l >= 50 && t < 50) return 'ne';
  if (l > 50 && t >= 50) return 'se';
  if (l <= 50 && t > 50) return 'sw';
  return 'nw';
}

export function getOppositeHandleId(handleId: string | null | undefined): string | undefined {
  if (!handleId) return undefined;
  if (handleId === 'default-nw') return 'default-se';
  if (handleId === 'default-se') return 'default-nw';
  if (handleId === 'default-ne') return 'default-sw';
  if (handleId === 'default-sw') return 'default-ne';
  
  if (handleId === 'top') return 'default-se';
  if (handleId === 'bottom') return 'default-nw';
  if (handleId === 'left') return 'default-ne';
  if (handleId === 'right') return 'default-sw';
  
  return undefined;
}

const isRoadsHome = (name: string) => /^[^-\s]+-[^-\s]+-[^-\s]+$/.test(name);


export const THETFORD_PORTAL_MAPS = new Set([
  'Widemoor Shore', 'Widemoor Hills', 'Widemoor Pool', 'Widemoor End', 'Willowshade Pools', 'Willowshade Wetlands', 'Widemoor Woods', 'Widemoor Flats', 'Widemoor Estuary', 'Widemoor Delta'
]);

export const MARTLOCK_PORTAL_MAPS = new Set([
  'Windgrass Coast', 'Windgrass Precipice', 'Windgrass Gully', 'Frostbite Mountain', 'Windgrass Border', 'Bleachskull Steppe', 'Windgrass Fields', 'Windgrass Rill', 'Windgrass Terrace', 'Mudfoot Sump', 'Mudfoot Mounds'
]);

export const BRIDGEWATCH_PORTAL_MAPS = new Set([
  'Farshore Cape', 'Farshore Bay', 'Stonelake Fields', 'Sandrift Prairie', 'Sandrift Dunes', 'Sandrift Steppe', 'Springsump Melt', 'Sandrift Expanse', 'Sandrift Coast', 'Sandrift Shore', 'Sandrift Fringe'
]);

export const LYMHURST_PORTAL_MAPS = new Set([
  'Thunderrock Rapids', 'Hightree Lake', 'Hightree Hillock', 'Hightree Pass', 'Hightree Steep', 'Hightree Strand', 'Hightree Levee', 'Hightree Enclave', 'Hightree Cliffs', 'Hightree Glade', 'Hightree Dale', 'Hightree Isle', 'Watchwood Grove', 'Watchwood Bluffs', 'Watchwood Precipice', 'Watchwood Lakeside', 'Skullmarsh Lower'
]);

export const FORT_STIRLING_PORTAL_MAPS = new Set([
  'Whitebank Shore', 'Frostpeak Vista', 'Frostpeak Ascent', 'Deepwood Dell', 'Deepwood Gorge', 'Whitebank Cross', 'Whitebank Wall', 'Whitebank Stream', 'Whitebank Ridge', 'Whitebank Descent', 'Meltwater Delta'
]);

export function getZoneCategory(name: string, type: string): string | undefined {
  if (type.startsWith('royal')) {
    // Exceptions first
    if (['Pen Fenair', 'Cairn Cloch', 'Cairn Clock', 'Cairn Glascore'].includes(name)) return 'Thetford RC';
    if (['Curlew Fen', 'Slimehag'].includes(name)) return 'Martlock RC';
    if (['Vixen Tor', 'Goffers Knoll', 'Kilmar Tor', 'Saddle Tor', 'Carns Hill', 'Brons Hill', 'Fractured Ground'].includes(name)) return 'Bridgewatch RC';
    if (['Goldshimmer Plain', 'Steelhide Meadow', 'Dryfield Meadow', 'Cracked Earth'].includes(name)) return 'Lymhurst RC';
    if (['Cedar Copse', 'Cedarcopse', 'Larchroad'].includes(name)) return 'Fort Stirling RC';

    // Thetford RC: Fen, Marsh, Swamp, Basin
    if (/(Fen|Marsh|Swamp|Basin)/i.test(name)) return 'Thetford RC';

    // Martlock RC: Quarry, Hill, Tor, Fell
    if (/(Quarry|Hill|Tor|Fell)/i.test(name)) return 'Martlock RC';

    // Bridgewatch RC: Plain, Steppe, Meadow
    if (/(Plain|Steppe|Meadow)/i.test(name)) return 'Bridgewatch RC';

    // Lymhurst RC: Wood, Forest, Ferndell, Birchcopse, Redlake, Stagbourne, Flynsdell, Oakcopse, Glen, Inis Mon
    if (/(Wood|Forest|Ferndell|Birchcopse|Redlake|Stagbourne|Flynsdell|Oakcopse|Glen|Inis Mon)/i.test(name)) return 'Lymhurst RC';

    // Fort Stirling RC: Fissure, Gorge, Camain, Pen, Creag, Cairn
    if (/(Fissure|Gorge|Camain)/i.test(name) || /^(Pen|Creag|Cairn)/i.test(name)) return 'Fort Stirling RC';
  }

  if (name.toLowerCase().endsWith(' portal')) {
    if (name.toLowerCase().startsWith('thetford')) return 'Thetford Portal';
    if (name.toLowerCase().startsWith('fort stirling')) return 'Fort Stirling Portal';
    if (name.toLowerCase().startsWith('lymhurst')) return 'Lymhurst Portal';
    if (name.toLowerCase().startsWith('bridgewatch')) return 'Bridgewatch Portal';
    if (name.toLowerCase().startsWith('martlock')) return 'Martlock Portal';
  }

  if (type === 'outlands') {
    // Specific Portal Zones
    if (THETFORD_PORTAL_MAPS.has(name)) return 'Thetford Portal';
    if (MARTLOCK_PORTAL_MAPS.has(name)) return 'Martlock Portal';
    if (BRIDGEWATCH_PORTAL_MAPS.has(name)) return 'Bridgewatch Portal';
    if (LYMHURST_PORTAL_MAPS.has(name)) return 'Lymhurst Portal';
    if (FORT_STIRLING_PORTAL_MAPS.has(name)) return 'Fort Stirling Portal';

    return 'Outlands';
  }

  return undefined;
}

export const ZONES: Zone[] = (mapsData as GameMap[]).map((m) => {
  const type = m.isRoadsHideout ? 'roadsHideout' : m.mapType;
  const zone: Zone = {
    id: m.mapID,
    name: m.mapName,
    type: type as ZoneType,
    tier: m.tier,
    knownResources: m.knownResources,
    category: m.category ?? getZoneCategory(m.mapName, m.mapType),
    mapShape: m.mapShape,
  };

  if (m.mapType === 'roads') {
    zone.isRoadsHome = m.isRoadsHideout || isRoadsHome(m.mapName);
  }

  return zone;
});

export const ZONE_BY_ID = new Map(ZONES.map((z) => [z.id, z]));
