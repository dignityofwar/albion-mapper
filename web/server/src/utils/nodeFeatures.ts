import { ZONE_BY_ID, NodeFeatures } from 'shared';

const RESOURCE_TO_FEATURE: Record<string, keyof NodeFeatures> = {
  'COTTON': 'resourceFibre',
  'HIDE': 'resourceLeather',
  'ORE': 'resourceOre',
  'ROCK': 'resourceStone',
  'LOGS': 'resourceWood'
};

export function getInitialFeatures(zoneId: string): NodeFeatures {
  const zone = ZONE_BY_ID.get(zoneId);
  const features: NodeFeatures = {};

  if (zone && zone.knownResources) {
    for (const res of zone.knownResources) {
      const featureKey = RESOURCE_TO_FEATURE[res];
      if (featureKey) {
        (features as any)[featureKey] = true;
      }
    }
  }

  return features;
}
