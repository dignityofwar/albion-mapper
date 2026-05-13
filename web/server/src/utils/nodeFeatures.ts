import { ZONE_BY_ID, NodeFeatures } from 'shared';

const RESOURCE_TO_FEATURE: Record<string, keyof NodeFeatures> = {
  'cotton': 'resourceFibre',
  'hide': 'resourceLeather',
  'ore': 'resourceOre',
  'rock': 'resourceStone',
  'logs': 'resourceWood',
  'largeBlueChest': 'treasuresBlue',
  'largeGreenChest': 'treasuresGreen',
  'largeYellowChest': 'treasuresYellow'
};

export function getInitialFeatures(zoneId: string): NodeFeatures {
  const zone = ZONE_BY_ID.get(zoneId);
  const features: NodeFeatures = {};

  if (zone && zone.knownFeatures) {
    for (const feat of zone.knownFeatures) {
      const featureKey = RESOURCE_TO_FEATURE[feat];
      if (featureKey) {
        (features as any)[featureKey] = true;
      }
    }
  }

  return features;
}
