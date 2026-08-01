# Zone Data Pipeline (`web/shared` + `map-parser`)

Single source of truth for zone data is the committed file **`web/shared/data/maps.json`** (~815 entries). `map-parser` **generates** it from an upstream dump; `web/shared/src/zones.ts` **adapts** it into runtime `Zone` objects. Server and client consume only the shared adapter, never the JSON directly. The production Docker image copies `web/shared/data` in so the server has it at runtime.

```
upstream JSON dump ──► map-parser sync-maps ──► web/shared/data/maps.json ──► shared zones.ts ──► ZONES / ZONE_BY_ID ──► server + client
```

## `maps.json` shape (`GameMap`)

```json
{ "mapID": "adrens-hill", "mapName": "Adrens Hill", "mapType": "royalYellow",
  "tier": 5, "category": "Martlock RC", "knownFeatures": [] }
```

Roads entries additionally carry `mapShape`, `socketCount`, `largeSocketCount`, `smallSocketCount`, and sometimes `isRoadsHideout: true`, `proximityTo`. Sorted deterministically by `mapID`. Distribution: roads 404, outlands 276, royalBlue 47, royalYellow 44, royalRed 43, other 1.

## The shared adapter (`web/shared/src/zones.ts`)

- `ZONES: Zone[]` — maps each `GameMap` → `Zone`: `mapID→id`, `mapName→name`, `mapType→type` (promoted to `'roadsHideout'` when `isRoadsHideout`), carries tier/knownFeatures/mapShape/proximityTo, derives `category`, and sets `isRoadsHome` for hideouts and three-part `X-Y-Z` names.
- `ZONE_BY_ID: Map<string, Zone>` — the lookup the server uses for all zone validation.
- `getZoneCategory(name, type)` — Royal Continent city grouping (Thetford/Martlock/Bridgewatch/Lymhurst/Fort Sterling RC) via exception lists + keyword regexes; outlands matched against hardcoded portal-map sets. `CAERLEON_RC_MAPS` → `'Caerleon RC'` is checked **before** everything else, because most of those names also match another city's keyword.

Other shared modules (barrel: `web/shared/src/index.ts`):

- `types.ts` — all domain interfaces, Zod request schemas, and the `ServerMessage`/`ClientMessage` WS unions ([websocket-protocol.md](websocket-protocol.md)). Also the chain colour palette (`CHAIN_COLOR_PALETTE`, `defaultChainColor`).
- `connections.ts` — `wouldCreateCycle` (direct A↔B) and `wouldCreateLongerLoop` (BFS, 3+ zone loops).
- `handles.ts` — handle geometry: `getDefaultHandles`, `getHandleFacing`, `getOppositeHandleId`, `getShapeHandlePositions(shape)` (fixed 6-point perimeter per shape letter `c,f,h,o,p,s,t,x`).
- `rotation.ts` — 0–3 clockwise 90°-step rotation model: `normalizeRotationSteps`, `rotationStepsToDegrees`, `inferRotationFromHandles`, `canonicalizeHandlesForRotation`, `inferRotationForZone`.

## map-parser

### Name heuristics — `map-parser/src/ZoneNameParser.ts`

- **Avalonian Rest (hideout):** name starts with `Qua/Qii/Sec/Set`, except hardcoded non-hideouts (`Setos-Aiaitum`, `Setitos-Obobrom`, `Setos-Avamsum` in `NON_HIDEOUT_PREFIX_MATCHES`).
- **Map shape:** `SHAPE_OVERRIDES` first (`Cieos-Atatlum`, `Cynitos-Atatlum` → `o`, both confirmed against the in-game map); then `'rest'` for Rests; otherwise the name's first letter if in `{c,f,h,o,p,s,t,x}`; else `'unknown'` (warns).
- **Guaranteed content:** last-segment suffix `-los`→LargeGreenChest, `-am`→LargeBlueChest, `-un`→LargeGoldChest.
- **Sockets per shape:** e.g. `t`/`x` → 3 large/5 small, `o`/`p` → 1/7, `rest` → 2/2.

### Classification — `classifyMapType` in `map-parser/scripts/syncMaps.ts`

1. **roads** — name matches `X-Y` or `X-Y-Z` hyphen patterns (hideout decided later by shape = `rest`).
2. **royalBlue/Yellow/Red / outlands** — from the upstream `color` field (black → outlands).
3. **outlands** — no color and no icons; else `'other'` + warn.

Resources come from `icons[].alt` filtered to `{rock, logs, ore, cotton, hide}`.

### The sync flow

```bash
pnpm --filter map-parser sync-maps            # fetches https://albionroadsmapper.com/avalon-roads-info.json
pnpm --filter map-parser sync-maps -- --source ./fixture.json --strict --output /tmp/maps.json
```

Pipeline (`map-parser/scripts/syncMaps.ts`): fetch/read source → skip `EXCLUDED_MAP_NAMES` (tutorial islands, `scripts/excludedMaps.ts`) → validate tier 1–8 → classify → apply `NAME_CORRECTIONS` → slug `mapID` → `buildGameMap` (category via shared `getZoneCategory`; roads get features/shape/sockets/hideout flag) → disambiguate duplicate ids with `-t{tier}` (hard-abort if still colliding) → validate each with `GameMapSchema` → append `MANUAL_MAPS` → apply `MAP_OVERRIDES` → sort by `mapID` → **atomic write** (tmp file + rename). `--strict` aborts on first warning.

**Data the feed doesn't carry** lives in `scripts/manualMaps.ts`, because a resync overwrites `maps.json` wholesale and anything only present in the committed file is otherwise lost:

- `MANUAL_MAPS` — whole entries the feed omits. Currently just `Brecilien`, which is a live room's home zone. Upstream wins a collision (warns) so the list can't shadow a zone the feed starts carrying.
- `MAP_OVERRIDES` — hand-curated fields patched onto upstream entries by `mapID`. Currently `proximityTo` on the 34 outlands zones bordering the three Rest cities; nothing derives it. Warns if the target `mapID` is gone.

Name fixes belong in `NAME_CORRECTIONS` rather than in `maps.json`, since `mapID` is derived from the name. Changing an id that is already in the database needs a migration alongside it — see `1777245947026_rename-brecillien-zone-id.js`.

`map-parser/scripts/migrateMaps.ts` is a one-off in-place re-derivation over the existing `maps.json` (recomputes shapes/sockets/content).

## Type ownership (be careful)

- **`GameMap` is owned by shared** (`web/shared/src/types.ts`); `map-parser/src/types.ts` re-exports it and keeps only the Zod `GameMapSchema` (typed `z.ZodType<GameMap>` so a field-type mismatch fails typecheck). When adding a `GameMap` field, add it to the shared interface **and** to `GameMapSchema` — Zod strips unknown keys, and both `syncMaps` and `migrateMaps` write `parsed.data`, so a field missing from the schema is silently dropped from `maps.json`.
- map-parser has **no build/typecheck step** in its scripts (`tsx` elides types at runtime) — run `npx tsc --noEmit` in `map-parser/` after touching its types.
