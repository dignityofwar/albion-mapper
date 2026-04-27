export const FACTIONS = {
  Thetford: { bgColor: '#5f315f', borderColor: '#b126f6' },
  Martlock: { bgColor: '#3d5fa3', borderColor: '#70a2ff' },
  Bridgewatch: { bgColor: '#d06723', borderColor: '#eca67b' },
  Lymhurst: { bgColor: '#4c560f', borderColor: '#049f00' },
  FortStirling: { bgColor: '#808080', borderColor: '#fff' },
};

export const FACTION_MAP: Record<string, { bgColor: string, borderColor: string }> = {
  'Thetford RC': FACTIONS.Thetford,
  'Thetford Portal': FACTIONS.Thetford,
  'Martlock RC': FACTIONS.Martlock,
  'Martlock Portal': FACTIONS.Martlock,
  'Bridgewatch RC': FACTIONS.Bridgewatch,
  'Bridgewatch Portal': FACTIONS.Bridgewatch,
  'Lymhurst RC': FACTIONS.Lymhurst,
  'Lymhurst Portal':  FACTIONS.Lymhurst,
  'Fort Stirling RC': FACTIONS.FortStirling,
  'Fort Stirling Portal': FACTIONS.FortStirling,
};
