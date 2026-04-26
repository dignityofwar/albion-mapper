import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { EXCLUDED_MAP_NAMES } from './excludedMaps.js';
import { GameMapSchema, type GameMap, type MapType } from '../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const UPSTREAM_URL = 'https://albionroadsmapper.com/avalon-roads-info.json';
const OUTPUT_PATH = resolve(__dirname, '../data/maps.json');

const RESOURCE_ICONS = new Set(['ROCK', 'LOGS', 'ORE', 'COTTON', 'HIDE']);

// ── CLI flags ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const strictMode = args.includes('--strict');
const sourceIndex = args.indexOf('--source');
const sourcePath = sourceIndex !== -1 ? args[sourceIndex + 1] : null;

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

function isHideout(name: string): boolean {
  return TWO_HYPHEN_RE.test(name);
}

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
      // Build record with disambiguated ID
      const gameMap: GameMap = { mapID: finalID, mapName, mapType: mapType!, tier: tierNum };
      if (mapType === 'roads') {
        if (isHideout(mapName)) gameMap.isRoadsHideout = true;
        gameMap.oresAvailable = extractOres(raw.icons);
      }
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
    const gameMap: GameMap = { mapID, mapName, mapType, tier: tierNum };

    if (mapType === 'roads') {
      if (isHideout(mapName)) gameMap.isRoadsHideout = true;
      gameMap.oresAvailable = extractOres(raw.icons);
    }

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
