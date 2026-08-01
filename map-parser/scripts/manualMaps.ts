import type { GameMap } from '../src/types.js';

// Zones the app needs that the upstream feed does not carry. Without this a clean
// resync deletes them, and Brecilien is a live room's home zone.
export const MANUAL_MAPS: GameMap[] = [
  {
    mapID: 'brecilien',
    mapName: 'Brecilien',
    mapType: 'other',
    tier: 1,
    knownFeatures: [],
  },
];

// Hand-curated fields patched onto upstream entries after they are built. The
// generator has no source for these, so without them a resync silently drops them.
export const MAP_OVERRIDES = new Map<string, Partial<GameMap>>([
  // The feed splits this zone across two spellings and only the excluded one
  // carries icons, so its resources are restored here.
  ['secent-al-odetis', { knownFeatures: ['rock'] }],

  // Outlands zones bordering each Avalonian Rest city.
  ...(['battlebrae-flatland', 'battlebrae-grassland', 'battlebrae-lake', 'battlebrae-meadow',
    'battlebrae-peaks', 'battlebrae-plain', 'deathreach-priory', 'dryvein-cross', 'farshore-esker',
    'longfen-veins', 'parchsand-drought', 'sunfang-dawn', 'whitewall-pass', 'whitewall-ridge',
  ].map((id) => [id, { proximityTo: "Arthur's Rest" }] as const)),

  ...(['drybasin-oasis', 'eye-of-the-forest', 'flammog-valley', 'giantweald-copse',
    'giantweald-dale', 'giantweald-glade', 'giantweald-roots', 'giantweald-woods',
  ].map((id) => [id, { proximityTo: "Merlyn's Rest" }] as const)),

  ...(['drownfield-fen', 'drownfield-mire', 'drownfield-quag', 'drownfield-rut',
    'drownfield-slough', 'everwinter-gap', 'everwinter-gorge', 'glacierfall-cross',
    'glacierfall-pass', 'glacierfall-valley', 'meltwater-channel', 'skysand-ridge',
  ].map((id) => [id, { proximityTo: "Morgana's Rest" }] as const)),
]);
