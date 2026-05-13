import { ZONE_BY_ID, NodeFeatures, ResourceType } from 'shared';

const KNOWN_FEATURE_TO_RESOURCE: Record<string, ResourceType> = {
  'cotton': 'fibre',
  'hide': 'leather',
  'ore': 'ore',
  'rock': 'stone',
  'logs': 'wood',
};

const KNOWN_FEATURE_TO_FLAG: Record<string, keyof NodeFeatures> = {
  'largeBlueChest': 'treasuresBlue',
  'largeGreenChest': 'treasuresGreen',
  'largeYellowChest': 'treasuresYellow',
};

export function getInitialFeatures(zoneId: string): NodeFeatures {
  const zone = ZONE_BY_ID.get(zoneId);
  const features: NodeFeatures = {};

  if (zone && zone.knownFeatures) {
    for (const feat of zone.knownFeatures) {
      const resourceType = KNOWN_FEATURE_TO_RESOURCE[feat];
      if (resourceType) {
        if (!features.resources) features.resources = [];
        if (!features.resources.find(r => r.type === resourceType)) {
          features.resources.push({ type: resourceType });
        }
        continue;
      }
      const flagKey = KNOWN_FEATURE_TO_FLAG[feat];
      if (flagKey) {
        (features as any)[flagKey] = true;
      }
    }
  }

  return features;
}
