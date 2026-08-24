export const EXCLUDED_MAP_NAMES = new Set([
  'The Lighthouse',
  'The Cove',
  'Forgotten Woods',
  'Mountain Fort',
  'VegAnimTest', // developer test map that appeared upstream
  // Upstream lists this zone twice, once with a capital I for the "Al" joiner.
  // The in-game title bar spells it "Secent-Al-Odetis", so this spelling loses.
  'Secent-AI-Odetis',
  // Same again: upstream lists Hiles-Izizaum a second time under an F. The
  // in-game title bar says Hiles, and no room has ever used the F spelling.
  'Files-Izizaum',
  // And again: upstream lists this zone a second time with an extra "t" before
  // the "om" suffix. The in-game title bar spells it "Tonitos-Uxavrom".
  'Tonitos-Uxavrtom',
]);
