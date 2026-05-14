import { ZONE_BY_ID, NodeFeatures, ResourceType } from 'shared';

const KNOWN_FEATURE_TO_RESOURCE: Record<string, ResourceType> = {
  'cotton': 'fibre',
  'hide': 'leather',
  'ore': 'ore',
  'rock': 'stone',
  'logs': 'wood',
};

const KNOWN_FEATURE_TO_COUNT: Record<string, keyof NodeFeatures> = {
  'largeBlueChest': 'treasuresBlueCount',
  'largeGreenChest': 'treasuresGreenCount',
  'largeYellowChest': 'treasuresYellowCount',
};

export function getInitialFeatures(zoneId: string): NodeFeatures {
  const zone = ZONE_BY_ID.get(zoneId);
  const features: NodeFeatures = {};
  const upstream: string[] = [];

  if (zone && zone.knownFeatures) {
    for (const feat of zone.knownFeatures) {
      const resourceType = KNOWN_FEATURE_TO_RESOURCE[feat];
      if (resourceType) {
        if (!features.resources) features.resources = [];
        if (!features.resources.find(r => r.type === resourceType)) {
          features.resources.push({ type: resourceType });
          upstream.push(resourceType);
        }
        continue;
      }
      const countKey = KNOWN_FEATURE_TO_COUNT[feat];
      if (countKey) {
        (features as any)[countKey] = 1;
        upstream.push(String(countKey));
      }
    }
  }

  if (upstream.length > 0) {
    features.upstreamFeatures = upstream;
  }

  return features;
}
