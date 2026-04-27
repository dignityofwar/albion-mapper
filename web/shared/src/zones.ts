import mapsData from '../data/maps.json' with { type: 'json' };
import type { GameMap, Zone } from './types.js';

const isRoadsHome = (name: string) => /^[^-\s]+-[^-\s]+-[^-\s]+$/.test(name);

export function getZoneCategory(name: string, type: string): string | undefined {
  if (type.startsWith('royal')) {
    // Exceptions first
    if (['Pen Fenair', 'Cairn Cloch', 'Cairn Clock', 'Cairn Glascore'].includes(name)) return 'Thetford RC';
    if (['Curlew Fen', 'Slimehag'].includes(name)) return 'Martlock RC';
    if (['Vixen Tor', 'Goffers Knoll', 'Kilmar Tor', 'Saddle Tor', 'Carns Hill', 'Brons Hill', 'Fractured Ground'].includes(name)) return 'Briddgewatch RC';
    if (['Goldshimmer Plain', 'Steelhide Meadow', 'Dryfield Meadow', 'Cracked Earth'].includes(name)) return 'Lymhurt RC';
    if (['Cedar Copse', 'Cedarcopse', 'Larchroad'].includes(name)) return 'Fort Stirling RC';

    // Thetford RC: Fen, Marsh, Swamp, Basin
    if (/(Fen|Marsh|Swamp|Basin)/i.test(name)) return 'Thetford RC';

    // Martlock RC: Quarry, Hill, Tor, Fell
    if (/(Quarry|Hill|Tor|Fell)/i.test(name)) return 'Martlock RC';

    // Briddgewatch RC: Plain, Steppe, Meadow
    if (/(Plain|Steppe|Meadow)/i.test(name)) return 'Briddgewatch RC';

    // Lymhurt RC: Wood, Forest, Ferndell, Birchcopse, Redlake, Stagbourne, Flynsdell, Oakcopse, Glen, Inis Mon
    if (/(Wood|Forest|Ferndell|Birchcopse|Redlake|Stagbourne|Flynsdell|Oakcopse|Glen|Inis Mon)/i.test(name)) return 'Lymhurt RC';

    // Fort Stirling RC: Fissure, Gorge, Camain, Pen, Creag, Cairn
    if (/(Fissure|Gorge|Camain)/i.test(name) || /^(Pen|Creag|Cairn)/i.test(name)) return 'Fort Stirling RC';
  }

  if (name.toLowerCase().endsWith(' portal')) {
    if (name.toLowerCase().startsWith('thetford')) return 'Thetford Portal';
    if (name.toLowerCase().startsWith('fort stirling')) return 'Fort Stirling Portal';
    if (name.toLowerCase().startsWith('lymhurst') || name.toLowerCase().startsWith('lymhurt')) return 'Lymhurt Portal';
    if (name.toLowerCase().startsWith('bridgewatch') || name.toLowerCase().startsWith('briddgewatch')) return 'Briddgewatch Portal';
    if (name.toLowerCase().startsWith('martlock')) return 'Martlock Portal';
  }

  if (type === 'outlands') {
    // Specific Portal Zones
    if (name.startsWith('Widemoor') || name.startsWith('Willowshade')) return 'Thetford Portal';
    if (name.startsWith('Windgrass') || name.startsWith('Mudfoot') || name === 'Bleachskull Steppe' || name === 'Frostbite Mountain') return 'Martlock Portal';
    if (name.startsWith('Sandrift') || ['Farshore Cape', 'Farshore Bay', 'Stonelake Fields', 'Springsump Melt'].includes(name)) return 'Briddgewatch Portal';
    if (name.startsWith('Hightree') || ['Watchwood', 'Munten Rise', 'Thunderrock Rapids', 'Skullmarsh Lower'].includes(name)) return 'Lymhurt Portal';
    if (name.startsWith('Whitebank') || name.startsWith('Deepwood') || name.startsWith('Frostpeak') || name === 'Meltwater Delta') return 'Fort Stirling Portal';

    // Keyword based portals
    if (/(Fen|Marsh|Swamp|Basin)/i.test(name)) return 'Thetford Portal';
    if (/(Quarry|Hill|Tor|Fell)/i.test(name)) return 'Martlock Portal';
    if (/(Plain|Steppe|Meadow)/i.test(name)) return 'Briddgewatch Portal';
    if (/(Wood|Forest|Ferndell|Birchcopse|Redlake|Stagbourne|Flynsdell|Oakcopse)/i.test(name)) return 'Lymhurt Portal';
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
  };

  if (m.mapType === 'roads' || m.mapType === 'roadsHideout') {
    zone.isRoadsHome = m.mapType === 'roadsHideout' || isRoadsHome(m.mapName);
  }

  return zone;
});

export const ZONE_BY_ID = new Map(ZONES.map((z) => [z.id, z]));
