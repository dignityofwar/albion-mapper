import { describe, it, expect } from 'vitest';
import { ZONES, ZONE_BY_ID } from '../src/zones.js';
import mapsData from '../data/maps.json' with { type: 'json' };
import type { GameMap } from '../src/types.js';

const maps = mapsData as GameMap[];

describe('zones adapter', () => {
  it('maps each GameMap 1:1 to a Zone', () => {
    expect(ZONES).toHaveLength(maps.length);
  });

  it('renames mapID → id', () => {
    ZONES.forEach((zone, i) => {
      expect(zone.id).toBe(maps[i].mapID);
    });
  });

  it('renames mapName → name', () => {
    ZONES.forEach((zone, i) => {
      expect(zone.name).toBe(maps[i].mapName);
    });
  });

  it('renames mapType → type', () => {
    ZONES.forEach((zone, i) => {
      expect(zone.type).toBe(maps[i].mapType);
    });
  });

  it('renames oresAvailable → ores', () => {
    const roadZonesWithOres = maps.filter(
      (m) => m.mapType === 'roads' && m.oresAvailable && m.oresAvailable.length > 0,
    );
    roadZonesWithOres.forEach((m) => {
      const zone = ZONE_BY_ID.get(m.mapID);
      expect(zone).toBeDefined();
      expect(zone!.ores).toEqual(m.oresAvailable);
    });
  });

  it('sets isRoadsHome to true for roads zones with X-X-X name', () => {
    // Find zones with X-X-X pattern (exactly 3 hyphen-separated parts, no spaces)
    const xXxPattern = /^[^-\s]+-[^-\s]+-[^-\s]+$/;
    const homeRoadsZones = ZONES.filter(
      (z) => (z.type === 'roads' || z.type === 'roadsHideout') && xXxPattern.test(z.name),
    );
    homeRoadsZones.forEach((z) => {
      expect(z.isRoadsHome).toBe(true);
    });
    expect(homeRoadsZones.length).toBeGreaterThan(0);
  });

  it('sets isRoadsHome to false for roads zones with X-X name (two-part names)', () => {
    // Roads zones with exactly 2 hyphen-separated parts
    const twoPartPattern = /^[^-\s]+-[^-\s]+$/;
    const travelRoadsZones = ZONES.filter(
      (z) => z.type === 'roads' && twoPartPattern.test(z.name),
    );
    travelRoadsZones.forEach((z) => {
      expect(z.isRoadsHome).toBe(false);
    });
  });

  it('sets isRoadsHome to undefined for non-roads zones', () => {
    const nonRoadsZones = ZONES.filter((z) => z.type !== 'roads' && z.type !== 'roadsHideout');
    nonRoadsZones.forEach((z) => {
      expect(z.isRoadsHome).toBeUndefined();
    });
    expect(nonRoadsZones.length).toBeGreaterThan(0);
  });

  it('ZONE_BY_ID round-trips for every zone', () => {
    ZONES.forEach((zone) => {
      expect(ZONE_BY_ID.get(zone.id)).toBe(zone);
    });
  });

  it('ZONE_BY_ID has the same size as ZONES', () => {
    expect(ZONE_BY_ID.size).toBe(ZONES.length);
  });

  it('all zone tiers are integers between 1 and 8', () => {
    ZONES.forEach((z) => {
      expect(Number.isInteger(z.tier)).toBe(true);
      expect(z.tier).toBeGreaterThanOrEqual(1);
      expect(z.tier).toBeLessThanOrEqual(8);
    });
  });
});
