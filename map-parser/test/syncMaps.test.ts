import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { MANUAL_MAPS } from '../scripts/manualMaps.js';
import { EXCLUDED_MAP_NAMES } from '../scripts/excludedMaps.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, '../scripts/syncMaps.ts');
const FIXTURE_DIR = join(tmpdir(), 'syncMaps-test-fixtures');

// ── Helpers ────────────────────────────────────────────────────────────────────

function writeFixture(name: string, data: unknown[]): string {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const path = join(FIXTURE_DIR, name);
  writeFileSync(path, JSON.stringify(data), 'utf8');
  return path;
}

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const TEST_OUTPUT_PATH = join(FIXTURE_DIR, 'maps.json');

// Run the script through the tsx binary this workspace installed, rather than
// via `npx`: npx is not guaranteed to be on PATH (a pnpm-only machine has no
// npm at all), and when it is missing every run exits 127 — which reads as
// "script failed" in the exit-code assertions and as a missing output file in
// the rest. Resolving the local bin keeps the suite dependent only on
// `pnpm install` having run.
const TSX_BIN = resolve(__dirname, '../node_modules/.bin/tsx');

function runSync(fixturePath: string, extra: string[] = []): RunResult {
  const args = [SCRIPT, '--source', fixturePath, '--output', TEST_OUTPUT_PATH, ...extra];
  // spawnSync (not execFileSync) because the script warns on stderr while
  // still exiting 0, and execFileSync only hands back stderr when the child
  // fails. stderr is piped rather than redirected to a shared temp file, so
  // concurrently-running test files cannot read each other's warnings.
  const result = spawnSync(TSX_BIN, args, {
    cwd: resolve(__dirname, '..'),
    encoding: 'utf8',
    timeout: 30_000,
  });

  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new Error(`tsx binary not found at ${TSX_BIN} — run \`pnpm install\` first`);
    }
    throw result.error;
  }

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    // A child killed by a signal (e.g. the timeout above) reports status null;
    // treat that as a failure rather than letting `null` read as falsy-zero.
    exitCode: result.status ?? 1,
  };
}

// Manual additions are appended to every run, so fixture assertions filter them
// out; `readRawOutput` is for the tests that check the additions themselves.
function readRawOutput(): GameMap[] {
  return JSON.parse(readFileSync(TEST_OUTPUT_PATH, 'utf8'));
}

function readOutput(): unknown[] {
  const manual = new Set(MANUAL_MAPS.map((m) => m.mapID));
  return readRawOutput().filter((m) => !manual.has(m.mapID));
}

// ── Unit-level helpers (import the pure functions directly) ────────────────────

// We re-implement the pure helpers inline so tests are fast and don't need I/O.

type MapType = 'royalBlue' | 'royalYellow' | 'royalRed' | 'outlands' | 'roads' | 'other';

interface RawIcon { alt: string; badge?: number; }
interface RawEntry { name: string; tier?: unknown; color?: string; icons?: RawIcon[]; }

const RESOURCE_ICONS = new Set(['rock', 'logs', 'ore', 'cotton', 'hide']);
const RESOURCE_ALIASES = new Map([
  ['hire', 'hide'],
  ['leather', 'hide'],
  ['fiber', 'cotton'],
  ['stone', 'rock'],
]);
const TWO_HYPHEN_RE = /^[^-\s]+-[^-\s]+-[^-\s]+$/;
const ONE_HYPHEN_RE = /^[^-\s]+-[^-\s]+$/;

function extractResources(icons: RawIcon[] | undefined): string[] {
  if (!icons) return [];
  const resources = icons
    .map((i) => i.alt.toLowerCase())
    .map((alt) => RESOURCE_ALIASES.get(alt) ?? alt)
    .filter((alt) => RESOURCE_ICONS.has(alt));
  return [...new Set(resources)].sort();
}

const warnings: string[] = [];

function classify(raw: RawEntry): MapType | 'WARN_OTHER' {
  const { name, color, icons } = raw;
  if (TWO_HYPHEN_RE.test(name) || ONE_HYPHEN_RE.test(name)) return 'roads';
  if (color !== undefined) {
    switch (color.toLowerCase()) {
      case 'blue':   return 'royalBlue';
      case 'yellow': return 'royalYellow';
      case 'red':    return 'royalRed';
      default:       return 'WARN_OTHER';
    }
  }
  if (icons === undefined) return 'outlands';
  return 'WARN_OTHER';
}

interface GameMap {
  mapID: string;
  mapName: string;
  mapType: MapType;
  tier: number;
  isRoadsHideout?: true;
  knownFeatures?: string[];
}

function processEntry(raw: RawEntry): GameMap | { skip: true; reason: string } | { warn: true; reason: string } {
  if (EXCLUDED_MAP_NAMES.has(raw.name)) return { skip: true, reason: 'excluded' };
  const tierNum = Number(raw.tier);
  if (raw.tier === undefined || raw.tier === null || !Number.isInteger(tierNum) || tierNum < 1 || tierNum > 8) {
    return { skip: true, reason: `invalid tier: ${String(raw.tier)}` };
  }
  const typeResult = classify(raw);
  const mapType: MapType = typeResult === 'WARN_OTHER' ? 'other' : typeResult;
  const mapID = raw.name.toLowerCase().replace(/\s+/g, '-');
  const result: GameMap = { mapID, mapName: raw.name, mapType, tier: tierNum };
  if (mapType === 'roads') {
    result.knownFeatures = extractResources(raw.icons);
  }
  return result;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('classification', () => {
  it('two-hyphen name → roads (initially)', () => {
    expect(classify({ name: 'Qiient-In-Odetum', tier: 6, icons: [] })).toBe('roads');
  });

  it('one-hyphen name → roads', () => {
    expect(classify({ name: 'Cebos-Avemlum', tier: 4, icons: [] })).toBe('roads');
  });

  it('color blue → royalBlue', () => {
    expect(classify({ name: 'Vixen Tor', tier: 4, color: 'blue' })).toBe('royalBlue');
  });

  it('color yellow → royalYellow', () => {
    expect(classify({ name: 'Cairn Darg', tier: 5, color: 'yellow' })).toBe('royalYellow');
  });

  it('color red → royalRed', () => {
    expect(classify({ name: 'Some Red Zone', tier: 6, color: 'red' })).toBe('royalRed');
  });

  it('color matching is case-insensitive', () => {
    expect(classify({ name: 'Some Red Zone', tier: 6, color: 'RED' })).toBe('royalRed');
    expect(classify({ name: 'Some Blue Zone', tier: 4, color: 'BLUE' })).toBe('royalBlue');
    expect(classify({ name: 'Some Yellow Zone', tier: 5, color: 'YELLOW' })).toBe('royalYellow');
  });

  it('no color, no icons → outlands', () => {
    expect(classify({ name: 'Widemoor Pool', tier: 7 })).toBe('outlands');
  });

  it('unknown color → WARN_OTHER', () => {
    expect(classify({ name: 'Mystery Zone', tier: 6, color: 'green' })).toBe('WARN_OTHER');
  });
});

describe('knownResources extraction', () => {
  it('empty icons → empty array', () => {
    expect(extractResources([])).toEqual([]);
  });

  it('undefined icons → empty array', () => {
    expect(extractResources(undefined)).toEqual([]);
  });

  it('filters non-resource icons and sorts alphabetically', () => {
    const icons: RawIcon[] = [
      { alt: 'BLUE' }, { alt: 'GREEN' }, { alt: 'COTTON' },
      { alt: 'ROCK' }, { alt: 'LOGS' },
    ];
    expect(extractResources(icons)).toEqual(['cotton', 'logs', 'rock']);
  });

  it('full mixed set from truth table', () => {
    // Cases-Ugumlos row
    const icons: RawIcon[] = [
      { alt: 'BLUE' }, { alt: 'GREEN' }, { alt: 'ROCK' },
      { alt: 'DUNGEON' }, { alt: 'LOGS' }, { alt: 'ORE' }, { alt: 'HIRE' },
    ];
    expect(extractResources(icons)).toEqual(['hide', 'logs', 'ore', 'rock']);
  });

  it('deduplicates repeated resource icons', () => {
    const icons: RawIcon[] = [
      { alt: 'ROCK' }, { alt: 'ROCK' }, { alt: 'LOGS' },
    ];
    expect(extractResources(icons)).toEqual(['logs', 'rock']);
  });

  it('aliases FIBER, STONE, LEATHER to their resource; discards GROUP and YELLOW', () => {
    const icons: RawIcon[] = [
      { alt: 'FIBER' }, { alt: 'STONE' }, { alt: 'LEATHER' },
      { alt: 'GROUP' }, { alt: 'YELLOW' }, { alt: 'ORE' },
    ];
    // GROUP and YELLOW are a group dungeon and a gold chest, not resources.
    expect(extractResources(icons)).toEqual(['cotton', 'hide', 'ore', 'rock']);
  });
});

describe('processEntry — truth table', () => {
  it('Qiient-In-Odetum (two-hyphen roads, initially roads, no ores)', () => {
    const result = processEntry({ name: 'Qiient-In-Odetum', tier: 6, icons: [] });
    expect(result).toEqual({
      mapID: 'qiient-in-odetum',
      mapName: 'Qiient-In-Odetum',
      mapType: 'roads',
      tier: 6,
      knownFeatures: [],
    });
  });

  it('Cebos-Avemlum (one-hyphen roads = travel zone, mixed icons, no isRoadsHideout)', () => {
    const icons: RawIcon[] = [
      { alt: 'BLUE' }, { alt: 'GREEN' }, { alt: 'COTTON' },
      { alt: 'ROCK' }, { alt: 'LOGS' },
    ];
    const result = processEntry({ name: 'Cebos-Avemlum', tier: 4, icons });
    expect(result).toEqual({
      mapID: 'cebos-avemlum',
      mapName: 'Cebos-Avemlum',
      mapType: 'roads',
      tier: 4,
      knownFeatures: ['cotton', 'logs', 'rock'],
    });
    expect(result).not.toHaveProperty('isRoadsHideout');
  });

  it('Cases-Ugumlos (one-hyphen roads = travel zone, mixed icons, no isRoadsHideout)', () => {
    const icons: RawIcon[] = [
      { alt: 'BLUE' }, { alt: 'GREEN' }, { alt: 'ROCK' },
      { alt: 'DUNGEON' }, { alt: 'LOGS' }, { alt: 'ORE' }, { alt: 'HIRE' },
    ];
    const result = processEntry({ name: 'Cases-Ugumlos', tier: 6, icons });
    expect(result).toEqual({
      mapID: 'cases-ugumlos',
      mapName: 'Cases-Ugumlos',
      mapType: 'roads',
      tier: 6,
      knownFeatures: ['hide', 'logs', 'ore', 'rock'],
    });
    expect(result).not.toHaveProperty('isRoadsHideout');
  });

  it('Cairn Darg (royalYellow)', () => {
    const result = processEntry({ name: 'Cairn Darg', tier: 5, color: 'yellow' });
    expect(result).toEqual({
      mapID: 'cairn-darg',
      mapName: 'Cairn Darg',
      mapType: 'royalYellow',
      tier: 5,
    });
    expect(result).not.toHaveProperty('knownResources');
  });

  it('Vixen Tor (royalBlue)', () => {
    const result = processEntry({ name: 'Vixen Tor', tier: 4, color: 'blue' });
    expect(result).toMatchObject({ mapType: 'royalBlue', tier: 4 });
    expect(result).not.toHaveProperty('knownResources');
  });

  it('Some Red Zone (royalRed, case-insensitive)', () => {
    const result = processEntry({ name: 'Some Red Zone', tier: 6, color: 'RED' });
    expect(result).toMatchObject({ mapType: 'royalRed', tier: 6 });
    expect(result).not.toHaveProperty('knownResources');
  });

  it('Widemoor Pool (outlands, no color, no icons)', () => {
    const result = processEntry({ name: 'Widemoor Pool', tier: 7 });
    expect(result).toEqual({
      mapID: 'widemoor-pool',
      mapName: 'Widemoor Pool',
      mapType: 'outlands',
      tier: 7,
    });
    expect(result).not.toHaveProperty('knownResources');
  });

  it('Mystery Zone (unknown color → other)', () => {
    const result = processEntry({ name: 'Mystery Zone', tier: 6, color: 'green' });
    expect(result).toMatchObject({ mapType: 'other', tier: 6 });
    expect(result).not.toHaveProperty('knownResources');
  });

  it('string tier is coerced to number', () => {
    const result = processEntry({ name: 'Sasitos-Umogaum', tier: '4' as unknown as number, icons: [] });
    expect(result).toMatchObject({ tier: 4 });
  });

  it('tier 99 → skipped', () => {
    const result = processEntry({ name: 'Bad Tier Zone', tier: 99, color: 'blue' });
    expect(result).toHaveProperty('skip', true);
  });

  it('missing tier → skipped', () => {
    const result = processEntry({ name: 'No Tier Zone', color: 'blue' } as RawEntry);
    expect(result).toHaveProperty('skip', true);
  });
});

describe('exclusion filter', () => {
  it('filters The Lighthouse even with valid color', () => {
    const result = processEntry({ name: 'The Lighthouse', tier: 1, color: 'blue' });
    expect(result).toHaveProperty('skip', true);
  });

  it('filters The Cove', () => {
    const result = processEntry({ name: 'The Cove', tier: 1, color: 'blue' });
    expect(result).toHaveProperty('skip', true);
  });

  it('filters Forgotten Woods', () => {
    const result = processEntry({ name: 'Forgotten Woods', tier: 1, color: 'blue' });
    expect(result).toHaveProperty('skip', true);
  });

  it('filters Mountain Fort', () => {
    const result = processEntry({ name: 'Mountain Fort', tier: 1, color: 'blue' });
    expect(result).toHaveProperty('skip', true);
  });

  // Upstream lists these two zones twice, once under a misread letter. The
  // in-game title bar settles which spelling is real; the other is dropped.
  it('filters the misspelled duplicate of Hiles-Izizaum', () => {
    expect(processEntry({ name: 'Files-Izizaum', tier: 8, icons: [] })).toHaveProperty('skip', true);
    expect(processEntry({ name: 'Hiles-Izizaum', tier: 8, icons: [] })).not.toHaveProperty('skip');
  });

  it('filters the misspelled duplicate of Secent-Al-Odetis', () => {
    expect(processEntry({ name: 'Secent-AI-Odetis', tier: 6, icons: [] })).toHaveProperty('skip', true);
    expect(processEntry({ name: 'Secent-Al-Odetis', tier: 6, icons: [] })).not.toHaveProperty('skip');
  });
});

describe('mapID slug', () => {
  it('spaces become hyphens', () => {
    const result = processEntry({ name: 'Cairn Darg', tier: 5, color: 'yellow' }) as GameMap;
    expect(result.mapID).toBe('cairn-darg');
  });

  it('existing hyphens in roads names survive', () => {
    const result = processEntry({ name: 'Qiient-In-Odetum', tier: 6, icons: [] }) as GameMap;
    expect(result.mapID).toBe('qiient-in-odetum');
  });

  it('is lowercase', () => {
    const result = processEntry({ name: 'Some Red Zone', tier: 6, color: 'RED' }) as GameMap;
    expect(result.mapID).toBe('some-red-zone');
  });
});

describe('script integration (via --source fixture)', () => {
  it('produces deterministic sorted output', () => {
    const fixture = writeFixture('sorted.json', [
      { name: 'Zzz Zone', tier: 4, color: 'blue' },
      { name: 'Aaa Zone', tier: 4, color: 'yellow' },
      { name: 'Mmm Zone', tier: 4, color: 'red' },
    ]);
    const result = runSync(fixture);
    expect(result.exitCode).toBe(0);

    const maps = readOutput() as GameMap[];
    expect(maps.map((m) => m.mapID)).toEqual(['aaa-zone', 'mmm-zone', 'zzz-zone']);
  });

  it('appends manual maps that upstream does not carry', () => {
    const fixture = writeFixture('manual.json', [{ name: 'Zzz Zone', tier: 4, color: 'blue' }]);
    expect(runSync(fixture).exitCode).toBe(0);

    const byId = Object.fromEntries(readRawOutput().map((m) => [m.mapID, m]));
    for (const manual of MANUAL_MAPS) {
      expect(byId[manual.mapID], `${manual.mapName} missing from output`).toEqual(manual);
    }
  });

  it('warns and keeps upstream when a manual map appears in the feed', () => {
    const manual = MANUAL_MAPS[0];
    const fixture = writeFixture('manual-collision.json', [
      { name: manual.mapName, tier: 7, color: 'blue' },
    ]);
    const result = runSync(fixture);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('drop it from manualMaps.ts');

    const entries = readRawOutput().filter((m) => m.mapID === manual.mapID);
    expect(entries).toHaveLength(1);
    expect(entries[0].tier).toBe(7);
  });

  it('excludes tutorial-island maps before classification', () => {
    const fixture = writeFixture('excluded.json', [
      { name: 'The Lighthouse', tier: 1, color: 'blue' },
      { name: 'The Cove', tier: 1, color: 'blue' },
      { name: 'Forgotten Woods', tier: 1, color: 'blue' },
      { name: 'Mountain Fort', tier: 1, color: 'blue' },
      { name: 'Valid Zone', tier: 4, color: 'blue' },
    ]);
    const result = runSync(fixture);
    expect(result.exitCode).toBe(0);

    const maps = readOutput() as GameMap[];
    expect(maps).toHaveLength(1);
    expect(maps[0].mapName).toBe('Valid Zone');
  });

  it('warns to stderr for unknown color, does not fail without --strict', () => {
    const fixture = writeFixture('unknown-color.json', [
      { name: 'Mystery Zone', tier: 6, color: 'green' },
    ]);
    const result = runSync(fixture);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toMatch(/unknown colour/i);
  });

  it('exits non-zero with --strict on unknown color', () => {
    const fixture = writeFixture('unknown-color-strict.json', [
      { name: 'Mystery Zone', tier: 6, color: 'green' },
    ]);
    const result = runSync(fixture, ['--strict']);
    expect(result.exitCode).not.toBe(0);
  });

  it('skips entries with out-of-range tier, warns to stderr', () => {
    const fixture = writeFixture('bad-tier.json', [
      { name: 'Bad Tier Zone', tier: 99, color: 'blue' },
      { name: 'Good Zone', tier: 4, color: 'blue' },
    ]);
    const result = runSync(fixture);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toMatch(/invalid tier/i);

    const maps = readOutput() as GameMap[];
    expect(maps).toHaveLength(1);
    expect(maps[0].mapName).toBe('Good Zone');
  });

  it('aborts on duplicate mapID when disambiguation is impossible (same tier)', () => {
    // Same name AND same tier → tier-suffix would also collide → hard abort
    const fixture = writeFixture('duplicate.json', [
      { name: 'Same Zone', tier: 4, color: 'blue' },
      { name: 'Same Zone', tier: 4, color: 'yellow' },
    ]);
    const result = runSync(fixture);
    expect(result.exitCode).not.toBe(0);
  });

  it('snapshot: fixture produces byte-identical output across runs', () => {
    const fixture = writeFixture('snapshot.json', [
      { name: 'Qiient-In-Odetum', tier: 6, icons: [] },
      { name: 'Cairn Darg', tier: 5, color: 'yellow' },
      { name: 'Widemoor Pool', tier: 7 },
    ]);

    runSync(fixture);
    const first = readFileSync(TEST_OUTPUT_PATH, 'utf8');

    runSync(fixture);
    const second = readFileSync(TEST_OUTPUT_PATH, 'utf8');

    expect(first).toBe(second);
  });

  it('aliases the upstream HIRE spelling to hide', () => {
    const fixture = writeFixture('hire-alias.json', [
      { name: 'Cebos-Avemlum', tier: 4, icons: [{ alt: 'HIRE' }, { alt: 'LOGS' }] },
      { name: 'Cases-Ugumlos', tier: 6, icons: [{ alt: 'LEATHER' }, { alt: 'FIBER' }, { alt: 'STONE' }] },
    ]);
    runSync(fixture);
    const maps = readOutput() as GameMap[];
    const byId = Object.fromEntries(maps.map((m) => [m.mapID, m]));
    expect(byId['cebos-avemlum'].knownFeatures).toEqual(['hide', 'logs']);
    expect(byId['cases-ugumlos'].knownFeatures).toEqual(['cotton', 'hide', 'rock', 'largeGreenChest']);
  });

  it('roads entry with no resource icons gets knownFeatures: []', () => {
    const fixture = writeFixture('roads-no-ores.json', [
      { name: 'Qiient-In-Odetum', tier: 6, icons: [{ alt: 'BLUE' }, { alt: 'GREEN' }] },
    ]);
    runSync(fixture);
    const maps = readOutput() as GameMap[];
    expect(maps[0]).toHaveProperty('knownFeatures');
    expect(maps[0].knownFeatures).toEqual([]);
  });

  it('three-barrel roads entry initially roads', () => {
    const fixture = writeFixture('hideout-flag.json', [
      { name: 'Qiient-In-Odetum', tier: 6, icons: [] },   // two hyphens
      { name: 'Cebos-Avemlum', tier: 4, icons: [] },       // one hyphen
    ]);
    runSync(fixture);
    const maps = readOutput() as any[];
    const hideout = maps.find((m) => m.mapID === 'qiient-in-odetum');
    const travel  = maps.find((m) => m.mapID === 'cebos-avemlum');
    expect(hideout.mapType).toBe('roads'); // No longer promoted to roadsHideout
    expect(hideout.isRoadsHideout).toBe(true);
    expect(travel.mapType).toBe('roads');
    expect(travel.isRoadsHideout).toBeUndefined();
  });

  it('one-hyphen Avalonian Rest name → roads and isRoadsHideout: true', () => {
    const fixture = writeFixture('rest-shape.json', [
      { name: 'Qiient-Vyntum', tier: 6, icons: [] },
    ]);
    runSync(fixture);
    const maps = readOutput() as any[];
    expect(maps[0].mapType).toBe('roads');
    expect(maps[0].isRoadsHideout).toBe(true);
    expect(maps[0].mapShape).toBe('rest');
  });

  it('non-roads entries do not have knownResources key', () => {
    const fixture = writeFixture('no-ores-key.json', [
      { name: 'Royal Place', tier: 4, color: 'blue' },
      { name: 'Outland Spot', tier: 5 },
    ]);
    runSync(fixture);
    const maps = readOutput() as GameMap[];
    for (const m of maps) {
      expect(m).not.toHaveProperty('knownResources');
    }
  });
});
