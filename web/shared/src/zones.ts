import mapsData from '../data/maps.json' with { type: 'json' };
import type { GameMap, Zone, CustomHandle } from './types.js';

export function getDefaultHandles(shape?: string): CustomHandle[] {
  if (shape === 'h') {
    return [
      { id: 'h-nw-n', left: '37.5%', top: '12.5%' },
      { id: 'h-ne', left: '75%', top: '25%' },
      { id: 'h-e', left: '92%', top: '58%' },
      { id: 'h-s', left: '50%', top: '100%' },
      { id: 'h-sw', left: '25%', top: '75%' },
      { id: 'h-nw-w', left: '8%', top: '42%' },
    ];
  }
  
  if (shape && shape !== 'rest' && shape !== 'unknown') {
    // Return 8 handles for regular shapes
    return [
      { id: 'n', left: '50%', top: '0%' },
      { id: 'ne', left: '75%', top: '25%' },
      { id: 'e', left: '100%', top: '50%' },
      { id: 'se', left: '75%', top: '75%' },
      { id: 's', left: '50%', top: '100%' },
      { id: 'sw', left: '25%', top: '75%' },
      { id: 'w', left: '0%', top: '50%' },
      { id: 'nw', left: '25%', top: '25%' },
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

const isRoadsHome = (name: string) => /^[^-\s]+-[^-\s]+-[^-\s]+$/.test(name);

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
    if (name.toLowerCase().startsWith('lymhurst') || name.toLowerCase().startsWith('lymhurt')) return 'Lymhurst Portal';
    if (name.toLowerCase().startsWith('bridgewatch') || name.toLowerCase().startsWith('briddgewatch')) return 'Bridgewatch Portal';
    if (name.toLowerCase().startsWith('martlock')) return 'Martlock Portal';
  }

  if (type === 'outlands') {
    // Specific Portal Zones
    if (name.startsWith('Widemoor') || name.startsWith('Willowshade')) return 'Thetford Portal';
    if (name.startsWith('Windgrass') || name.startsWith('Mudfoot') || name === 'Bleachskull Steppe' || name === 'Frostbite Mountain') return 'Martlock Portal';
    if (name.startsWith('Sandrift') || ['Farshore Cape', 'Farshore Bay', 'Stonelake Fields', 'Springsump Melt'].includes(name)) return 'Bridgewatch Portal';
    if (name.startsWith('Hightree') || ['Watchwood', 'Munten Rise', 'Thunderrock Rapids', 'Skullmarsh Lower'].includes(name)) return 'Lymhurst Portal';
    if (name.startsWith('Whitebank') || name.startsWith('Deepwood') || name.startsWith('Frostpeak') || name === 'Meltwater Delta') return 'Fort Stirling Portal';

    // Keyword based portals
    if (/(Fen|Marsh|Swamp|Basin)/i.test(name)) return 'Thetford Portal';
    if (/(Quarry|Hill|Tor|Fell)/i.test(name)) return 'Martlock Portal';
    if (/(Plain|Steppe|Meadow)/i.test(name)) return 'Bridgewatch Portal';
    if (/(Wood|Forest|Ferndell|Birchcopse|Redlake|Stagbourne|Flynsdell|Oakcopse)/i.test(name)) return 'Lymhurst Portal';
    if (/(Fissure|Gorge|Camain)/i.test(name) || /^(Pen|Creag|Cairn)/i.test(name)) return 'Fort Stirling Portal';

    return 'Outlands';
  }

  return undefined;
}

export const ZONES: Zone[] = (mapsData as GameMap[]).map((m) => {
  const zone: Zone = {
    id: m.mapID,
    name: m.mapName,
    type: m.mapType,
    tier: m.tier,
    ores: m.oresAvailable,
    category: m.category ?? getZoneCategory(m.mapName, m.mapType),
    mapShape: m.mapShape,
  };

  if (m.mapType === 'roads') {
    zone.isRoadsHome = m.isRoadsHideout || isRoadsHome(m.mapName);
  }

  return zone;
});

export const ZONE_BY_ID = new Map(ZONES.map((z) => [z.id, z]));
