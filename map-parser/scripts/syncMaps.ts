import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { EXCLUDED_MAP_NAMES } from './excludedMaps.js';
import { GameMapSchema, type GameMap, type MapType } from '../src/types.js';
import { ZoneNameParser } from '../src/ZoneNameParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const strictMode = args.includes('--strict');
const sourceIndex = args.indexOf('--source');
const sourcePath = sourceIndex !== -1 ? args[sourceIndex + 1] : null;

const outputIndex = args.indexOf('--output');
const OUTPUT_PATH = outputIndex !== -1
  ? resolve(process.cwd(), args[outputIndex + 1])
  : resolve(__dirname, '../../web/shared/data/maps.json');

const UPSTREAM_URL = 'https://albionroadsmapper.com/avalon-roads-info.json';
const RESOURCE_ICONS = new Set(['ROCK', 'LOGS', 'ORE', 'COTTON', 'HIDE']);

// ── Warning helper ─────────────────────────────────────────────────────────────

let warnCount = 0;

function warn(message: string): void {
  warnCount++;
  process.stderr.write(`[warn] ${message}\n`);
  if (strictMode) {
    process.stderr.write('[strict] Aborting due to --strict flag.\n');
    process.exit(1);
  }
}

// ── Raw source shape ───────────────────────────────────────────────────────────

interface RawIcon {
  alt: string;
  badge?: number;
}

interface RawEntry {
  name: string;
  tier?: unknown;
  color?: string;
  icons?: RawIcon[];
  [key: string]: unknown;
}

// ── Classification ─────────────────────────────────────────────────────────────

const TWO_HYPHEN_RE = /^[^-\s]+-[^-\s]+-[^-\s]+$/;
const ONE_HYPHEN_RE = /^[^-\s]+-[^-\s]+$/;

function classifyMapType(raw: RawEntry): MapType | null {
  const { name, color, icons } = raw;

  if (TWO_HYPHEN_RE.test(name) || ONE_HYPHEN_RE.test(name)) {
    return 'roads';
  }

  if (color !== undefined) {
    switch (color.toLowerCase()) {
      case 'blue':   return 'royalBlue';
      case 'yellow': return 'royalYellow';
      case 'red':    return 'royalRed';
      case 'black':  return 'outlands';
      default:
        warn(`Unknown colour "${color}" for entry "${name}" — classifying as 'other'.`);
        return 'other';
    }
  }

  if (icons === undefined) {
    return 'outlands';
  }

  warn(`Unexpected shape for entry "${name}" (has icons but no color and no hyphen-pattern name) — classifying as 'other'.`);
  return 'other';
}

// ── oresAvailable extraction ───────────────────────────────────────────────────

function extractOres(icons: RawIcon[] | undefined): string[] {
  if (!icons) return [];
  const resources = icons
    .map((i) => i.alt)
    .filter((alt) => RESOURCE_ICONS.has(alt));
  return [...new Set(resources)].sort();
}

// ── Main ───────────────────────────────────────────────────────────────────────

function getZoneCategory(name: string, type: string): string | undefined {
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

async function fetchRaw(): Promise<RawEntry[]> {
  if (sourcePath) {
    const text = readFileSync(resolve(process.cwd(), sourcePath), 'utf8');
    return JSON.parse(text) as RawEntry[];
  }
  const res = await fetch(UPSTREAM_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch upstream data: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<RawEntry[]>;
}

async function main(): Promise<void> {
  const rawEntries = await fetchRaw();

  const maps: GameMap[] = [];
  const seenIDs = new Map<string, string>();

  for (const raw of rawEntries) {
    // 1. Exclusion filter
    if (EXCLUDED_MAP_NAMES.has(raw.name)) {
      continue;
    }

    // 2. Tier coercion & validation
    const tierNum = Number(raw.tier);
    if (raw.tier === undefined || raw.tier === null || !Number.isInteger(tierNum) || tierNum < 1 || tierNum > 8) {
      warn(`Skipping "${raw.name}": invalid tier (${String(raw.tier)}).`);
      continue;
    }

    // 3. Classification
    const mapType = classifyMapType(raw);
    if (mapType === null) continue;

    // 4. Build record
    const mapName = raw.name;
    const mapID = mapName.toLowerCase().replace(/\s+/g, '-');

    const buildGameMap = (id: string, name: string, type: MapType, tier: number, icons?: RawIcon[]): GameMap => {
      const gameMap: GameMap = {
        mapID: id,
        mapName: name,
        mapType: type,
        tier,
        category: getZoneCategory(name, type),
      };

      if (type === 'roads' || type === 'roadsHideout') {
        gameMap.oresAvailable = extractOres(icons);

        const shape = ZoneNameParser.parseMapShape({ mapName: name, mapID: id } as any);
        const socketInfo = ZoneNameParser.resolveSocketInfo(shape);
        const guaranteedContent = ZoneNameParser.parseGuaranteedContent({ mapName: name } as any);

        gameMap.mapShape = shape;
        gameMap.socketCount = socketInfo.socketCount;
        gameMap.largeSocketCount = socketInfo.largeSocketCount;
        gameMap.smallSocketCount = socketInfo.smallSocketCount;
        gameMap.socketCountIsMinimum = socketInfo.socketCountIsMinimum;
        gameMap.guaranteedContent = guaranteedContent;

        if (shape === 'rest') {
          gameMap.isRoadsHideout = true;
        }
      }

      return gameMap;
    };

    // 5. Duplicate ID check — disambiguate with tier suffix, then hard-abort if still colliding
    if (seenIDs.has(mapID)) {
      const existingEntry = seenIDs.get(mapID)!;
      // Same name, different tier — safe to disambiguate with tier suffix
      const disambiguated = `${mapID}-t${tierNum}`;
      process.stderr.write(
        `[warn] Duplicate mapID "${mapID}" for "${existingEntry}" and "${mapName}" ` +
        `(different tiers). Using tier-suffixed ID "${disambiguated}" for the new entry.\n`
      );
      // Also fix the first entry's ID if not yet disambiguated
      const firstEntry = maps.find((m) => m.mapID === mapID);
      if (firstEntry) {
        const firstDisambiguated = `${mapID}-t${firstEntry.tier}`;
        if (seenIDs.has(firstDisambiguated)) {
          process.stderr.write(
            `[error] Cannot disambiguate: "${firstDisambiguated}" is also taken. Aborting.\n`
          );
          process.exit(1);
        }
        seenIDs.delete(mapID);
        seenIDs.set(firstDisambiguated, firstEntry.mapName);
        firstEntry.mapID = firstDisambiguated;
      }
      const finalID = disambiguated;
      if (seenIDs.has(finalID)) {
        process.stderr.write(
          `[error] Cannot disambiguate: "${finalID}" is also taken. Aborting.\n`
        );
        process.exit(1);
      }
      seenIDs.set(finalID, mapName);
      
      const gameMap = buildGameMap(finalID, mapName, mapType!, tierNum, raw.icons);
      
      const parsed = GameMapSchema.safeParse(gameMap);
      if (!parsed.success) {
        warn(`Zod validation failed for "${mapName}": ${parsed.error.message}`);
        continue;
      }
      maps.push(parsed.data as GameMap);
      continue;
    }
    seenIDs.set(mapID, mapName);

    // 6. Build GameMap
    const gameMap = buildGameMap(mapID, mapName, mapType, tierNum, raw.icons);

    // 7. Validate against Zod schema
    const parsed = GameMapSchema.safeParse(gameMap);
    if (!parsed.success) {
      warn(`Zod validation failed for "${mapName}": ${parsed.error.message}`);
      continue;
    }

    maps.push(parsed.data as GameMap);
  }

  // 8. Sort deterministically by mapID
  maps.sort((a, b) => a.mapID.localeCompare(b.mapID));

  // 9. Atomic write
  const json = JSON.stringify(maps, null, 2) + '\n';
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  const tmpPath = OUTPUT_PATH + '.tmp';
  writeFileSync(tmpPath, json, 'utf8');
  renameSync(tmpPath, OUTPUT_PATH);

  process.stdout.write(`Wrote ${maps.length} maps to ${OUTPUT_PATH}\n`);
  if (warnCount > 0) {
    process.stderr.write(`${warnCount} warning(s) emitted.\n`);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`[fatal] ${String(err)}\n`);
  process.exit(1);
});
