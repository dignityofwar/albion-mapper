import mapsData from '../data/maps.json' with { type: 'json' };
import type { GameMap, Zone, ZoneType } from './types.js';

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
