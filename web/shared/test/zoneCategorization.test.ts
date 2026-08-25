import { describe, it, expect } from 'vitest';
import { CAERLEON_RC_MAPS, getZoneCategory, ZONES } from '../src/zones.js';

describe('zone categorization', () => {
  describe('Royal Continent (RC)', () => {
    describe('Thetford RC', () => {
      it('categorizes by keywords: Fen, Marsh, Swamp, Basin', () => {
        expect(getZoneCategory('Bonepool Marsh', 'royalYellow')).toBe('Thetford RC');
        expect(getZoneCategory('Sunstrand Fen', 'royalBlue')).toBe('Thetford RC');
        expect(getZoneCategory('Hagast Swamp', 'royalRed')).toBe('Thetford RC');
        expect(getZoneCategory('Great Basin', 'royalYellow')).toBe('Thetford RC');
      });

      it('handles exceptions: Pen Fenair, Cairn Cloch, etc.', () => {
        expect(getZoneCategory('Pen Fenair', 'royalBlue')).toBe('Thetford RC');
        expect(getZoneCategory('Cairn Cloch', 'royalYellow')).toBe('Thetford RC');
        expect(getZoneCategory('Cairn Glascore', 'royalRed')).toBe('Thetford RC');
      });
    });

    describe('Martlock RC', () => {
      it('categorizes by keywords: Quarry, Hill, Tor, Fell', () => {
        expect(getZoneCategory('Blackthorn Quarry', 'royalBlue')).toBe('Martlock RC');
        expect(getZoneCategory('Adrens Hill', 'royalYellow')).toBe('Martlock RC');
        expect(getZoneCategory('Haytor', 'royalBlue')).toBe('Martlock RC');
        expect(getZoneCategory('Bowscale Fell', 'royalRed')).toBe('Martlock RC');
      });

      it('handles exceptions: Curlew Fen, Slimehag', () => {
        expect(getZoneCategory('Curlew Fen', 'royalYellow')).toBe('Martlock RC');
        expect(getZoneCategory('Slimehag', 'royalRed')).toBe('Martlock RC');
      });
    });

    describe('Bridgewatch RC', () => {
      it('categorizes by keywords: Plain, Steppe, Meadow', () => {
        expect(getZoneCategory('Feltand Plain', 'royalYellow')).toBe('Bridgewatch RC');
        expect(getZoneCategory('Drytop Steppe', 'royalBlue')).toBe('Bridgewatch RC');
        expect(getZoneCategory('Lazygrass Meadow', 'royalYellow')).toBe('Bridgewatch RC');
      });

      it('handles exceptions: Vixen Tor, Goffers Knoll, Carns Hill, etc.', () => {
        expect(getZoneCategory('Vixen Tor', 'royalRed')).toBe('Bridgewatch RC');
        expect(getZoneCategory('Goffers Knoll', 'royalBlue')).toBe('Bridgewatch RC');
        expect(getZoneCategory('Kilmar Tor', 'royalRed')).toBe('Bridgewatch RC');
        expect(getZoneCategory('Saddle Tor', 'royalYellow')).toBe('Bridgewatch RC');
        expect(getZoneCategory('Carns Hill', 'royalBlue')).toBe('Bridgewatch RC');
        expect(getZoneCategory('Brons Hill', 'royalYellow')).toBe('Bridgewatch RC');
        expect(getZoneCategory('Fractured Ground', 'royalRed')).toBe('Bridgewatch RC');
      });
    });

    describe('Lymhurst RC', () => {
      it('categorizes by keywords: Wood, Forest, Ferndell, Glen, Inis Mon, etc.', () => {
        expect(getZoneCategory('Aspenwood', 'royalYellow')).toBe('Lymhurst RC');
        expect(getZoneCategory('Forest Burrow', 'royalRed')).toBe('Lymhurst RC');
        expect(getZoneCategory('Ferndell', 'royalRed')).toBe('Lymhurst RC');
        expect(getZoneCategory('Birchcopse', 'royalBlue')).toBe('Lymhurst RC');
        expect(getZoneCategory('Owlsong Glen', 'royalYellow')).toBe('Lymhurst RC');
        expect(getZoneCategory('Highbole Glen', 'royalRed')).toBe('Lymhurst RC');
        expect(getZoneCategory('Inis Mon', 'royalRed')).toBe('Lymhurst RC');
      });

      it('handles exceptions: Goldshimmer Plain, Steelhide Meadow, etc.', () => {
        expect(getZoneCategory('Goldshimmer Plain', 'royalYellow')).toBe('Lymhurst RC');
        expect(getZoneCategory('Steelhide Meadow', 'royalRed')).toBe('Lymhurst RC');
        expect(getZoneCategory('Dryfield Meadow', 'royalYellow')).toBe('Lymhurst RC');
        expect(getZoneCategory('Cracked Earth', 'royalRed')).toBe('Lymhurst RC');
      });
    });

    describe('Fort Sterling RC', () => {
      it('categorizes by keywords/prefixes: Fissure, Gorge, Camain, Pen, Creag, Cairn', () => {
        expect(getZoneCategory('Deadvein Fissure', 'royalRed')).toBe('Fort Sterling RC');
        expect(getZoneCategory('Bryn Gorge', 'royalBlue')).toBe('Fort Sterling RC');
        expect(getZoneCategory('Cairn Camain', 'royalYellow')).toBe('Fort Sterling RC');
        expect(getZoneCategory('Pen Digra', 'royalRed')).toBe('Fort Sterling RC');
        expect(getZoneCategory('Creag Garr', 'royalRed')).toBe('Fort Sterling RC');
      });

      it('handles exceptions: Cedar Copse, Larchroad', () => {
        expect(getZoneCategory('Cedar Copse', 'royalBlue')).toBe('Fort Sterling RC');
        expect(getZoneCategory('Cedarcopse', 'royalBlue')).toBe('Fort Sterling RC');
        expect(getZoneCategory('Larchroad', 'royalRed')).toBe('Fort Sterling RC');
      });
    });

    describe('Caerleon RC', () => {
      it('categorizes the Caerleon red zones', () => {
        expect(getZoneCategory('Malag Crevasse', 'royalRed')).toBe('Caerleon RC');
        expect(getZoneCategory('Creag Morr', 'royalRed')).toBe('Caerleon RC');
        expect(getZoneCategory('Domhain Chasm', 'royalRed')).toBe('Caerleon RC');
        expect(getZoneCategory('Longtimber Glen', 'royalRed')).toBe('Caerleon RC');
        expect(getZoneCategory('Nightbloom Forest', 'royalRed')).toBe('Caerleon RC');
        expect(getZoneCategory('Wyre Forest', 'royalRed')).toBe('Caerleon RC');
        expect(getZoneCategory('Deadvein Gully', 'royalRed')).toBe('Caerleon RC');
        expect(getZoneCategory('Roastcorpse Steppe', 'royalRed')).toBe('Caerleon RC');
        expect(getZoneCategory('Mardale', 'royalRed')).toBe('Caerleon RC');
        expect(getZoneCategory('Birken Fell', 'royalRed')).toBe('Caerleon RC');
        expect(getZoneCategory('Murkweald', 'royalRed')).toBe('Caerleon RC');
      });

      it('wins over the city keyword regexes that used to claim these names', () => {
        // Forest/Glen → Lymhurst, Fell → Martlock, Steppe → Bridgewatch, Creag → Fort Sterling
        expect(getZoneCategory('Wyre Forest', 'royalRed')).not.toBe('Lymhurst RC');
        expect(getZoneCategory('Longtimber Glen', 'royalRed')).not.toBe('Lymhurst RC');
        expect(getZoneCategory('Birken Fell', 'royalRed')).not.toBe('Martlock RC');
        expect(getZoneCategory('Roastcorpse Steppe', 'royalRed')).not.toBe('Bridgewatch RC');
        expect(getZoneCategory('Creag Morr', 'royalRed')).not.toBe('Fort Sterling RC');
      });

      it('leaves same-keyword zones outside the list on their old category', () => {
        expect(getZoneCategory('Aspenwood', 'royalYellow')).toBe('Lymhurst RC');
        expect(getZoneCategory('Owlsong Glen', 'royalYellow')).toBe('Lymhurst RC');
        expect(getZoneCategory('Drytop Steppe', 'royalBlue')).toBe('Bridgewatch RC');
        expect(getZoneCategory('Creag Garr', 'royalRed')).toBe('Fort Sterling RC');
      });
    });
  });

  describe('Outlands Portals', () => {
    it('categorizes portals correctly', () => {
      expect(getZoneCategory('Thetford Portal', 'outlands')).toBe('Thetford Portal');
      expect(getZoneCategory('Fort Sterling Portal', 'outlands')).toBe('Fort Sterling Portal');
      expect(getZoneCategory('Lymhurst Portal', 'outlands')).toBe('Lymhurst Portal');
      expect(getZoneCategory('Bridgewatch Portal', 'outlands')).toBe('Bridgewatch Portal');
      expect(getZoneCategory('Martlock Portal', 'outlands')).toBe('Martlock Portal');
    });

    it('handles misspellings/variations in portal names', () => {
      expect(getZoneCategory('Lymhurst Portal', 'outlands')).toBe('Lymhurst Portal');
      expect(getZoneCategory('Bridgewatch Portal', 'outlands')).toBe('Bridgewatch Portal');
    });

    it('categorizes specific portal zones by prefix/list', () => {
      // Thetford
      expect(getZoneCategory('Widemoor Delta', 'outlands')).toBe('Thetford Portal');
      expect(getZoneCategory('Willowshade Hills', 'outlands')).toBe('Outlands');

      // Martlock
      expect(getZoneCategory('Windgrass Fields', 'outlands')).toBe('Martlock Portal');
      expect(getZoneCategory('Mudfoot Sump', 'outlands')).toBe('Martlock Portal');
      expect(getZoneCategory('Bleachskull Steppe', 'outlands')).toBe('Martlock Portal');
      expect(getZoneCategory('Frostbite Mountain', 'outlands')).toBe('Martlock Portal');

      // Bridgewatch
      expect(getZoneCategory('Farshore Bay', 'outlands')).toBe('Bridgewatch Portal');

      // Lymhurst
      expect(getZoneCategory('Hightree Lake', 'outlands')).toBe('Lymhurst Portal');
      expect(getZoneCategory('Watchwood Grove', 'outlands')).toBe('Lymhurst Portal');

      // Fort Sterling
      expect(getZoneCategory('Whitebank Wall', 'outlands')).toBe('Fort Sterling Portal');
      expect(getZoneCategory('Deepwood Gorge', 'outlands')).toBe('Fort Sterling Portal');
      expect(getZoneCategory('Frostpeak Ascent', 'outlands')).toBe('Fort Sterling Portal');
      expect(getZoneCategory('Meltwater Delta', 'outlands')).toBe('Fort Sterling Portal');
    });

    it('categorizes non-portal outlands zones as Outlands', () => {
      expect(getZoneCategory('Widemoor Fen', 'outlands')).toBe('Outlands');
      expect(getZoneCategory('Willowshade Hills', 'outlands')).toBe('Outlands');
      expect(getZoneCategory('Battlebrae Meadow', 'outlands')).toBe('Outlands');
      expect(getZoneCategory('Southgrove Wood', 'outlands')).toBe('Outlands');
      expect(getZoneCategory('Deepwood Gorge', 'outlands')).toBe('Fort Sterling Portal');
    });
  });

  it('returns undefined for non-matching zones', () => {
    expect(getZoneCategory('Caerleon', 'royalRed')).toBeUndefined();
    expect(getZoneCategory('Cilos-Otatrom', 'roads')).toBeUndefined();
  });

  it('categorizes non-portal outlands zones as Outlands', () => {
    expect(getZoneCategory('Arthur\'s Rest', 'outlands')).toBe('Outlands');
    expect(getZoneCategory('Highbeech Opening', 'outlands')).toBe('Outlands');
  });

  describe('maps.json agrees with getZoneCategory', () => {
    it('every Caerleon RC name exists in maps.json and carries the category', () => {
      for (const name of CAERLEON_RC_MAPS) {
        const zone = ZONES.find((z) => z.name === name);
        expect(zone, `${name} is missing from maps.json`).toBeDefined();
        expect(zone!.category, name).toBe('Caerleon RC');
      }
    });

    it('no other zone claims Caerleon RC', () => {
      const tagged = ZONES.filter((z) => z.category === 'Caerleon RC').map((z) => z.name);
      expect(tagged.sort()).toEqual([...CAERLEON_RC_MAPS].sort());
    });
  });

  describe('Spot Checks from User', () => {
    it('Thetford', () => {
      // Portal
      expect(getZoneCategory('Willowshade Pools', 'outlands')).toBe('Thetford Portal');
      expect(getZoneCategory('Willowshade Shore', 'outlands')).toBe('Outlands');
      // City
      expect(getZoneCategory('Dusklight Fen', 'royalBlue')).toBe('Thetford RC');
      expect(getZoneCategory('Drownhorse Basin', 'royalYellow')).toBe('Thetford RC');
    });

    it('Martlock', () => {
      // Portal
      expect(getZoneCategory('Bleachskull Steppe', 'outlands')).toBe('Martlock Portal');
      expect(getZoneCategory('Mudfoot Mounds', 'outlands')).toBe('Martlock Portal');
      // City
      expect(getZoneCategory('Blackthorn Quarry', 'royalBlue')).toBe('Martlock RC');
      expect(getZoneCategory('Haldon Tor', 'royalBlue')).toBe('Martlock RC');
    });

    it('Bridgewatch', () => {
      // City
      expect(getZoneCategory('Vixen Tor', 'royalRed')).toBe('Bridgewatch RC');
      expect(getZoneCategory('Kilmar Tor', 'royalRed')).toBe('Bridgewatch RC');
      expect(getZoneCategory('Carns Hill', 'royalBlue')).toBe('Bridgewatch RC');
      expect(getZoneCategory('Brons Hill', 'royalYellow')).toBe('Bridgewatch RC');
      expect(getZoneCategory('Fractured Ground', 'royalRed')).toBe('Bridgewatch RC');
      expect(getZoneCategory('Slowtree Plain', 'royalYellow')).toBe('Bridgewatch RC');
      // Portal
      expect(getZoneCategory('Sandrift Steppe', 'outlands')).toBe('Bridgewatch Portal');
      expect(getZoneCategory('Sandrift Prairie', 'outlands')).toBe('Bridgewatch Portal');
      expect(getZoneCategory('Stonelake Fields', 'outlands')).toBe('Bridgewatch Portal');
    });

    it('Lymhurst', () => {
      // Portal
      expect(getZoneCategory('Hightree Cliffs', 'outlands')).toBe('Lymhurst Portal');
      expect(getZoneCategory('Watchwood Precipice', 'outlands')).toBe('Lymhurst Portal');
      expect(getZoneCategory('Munten Rise', 'outlands')).toBe('Lymhurst Portal');
      // City
      expect(getZoneCategory('Ferndell', 'royalRed')).toBe('Lymhurst RC');
      expect(getZoneCategory('Yew Wood', 'royalYellow')).toBe('Lymhurst RC');
      expect(getZoneCategory('Owlsong Glen', 'royalYellow')).toBe('Lymhurst RC');
      expect(getZoneCategory('Highbole Glen', 'royalRed')).toBe('Lymhurst RC');
      expect(getZoneCategory('Inis Mon', 'royalRed')).toBe('Lymhurst RC');
    });

    it('Fort Sterling', () => {
      // City
      expect(getZoneCategory('Pen Gent', 'royalBlue')).toBe('Fort Sterling RC');
      expect(getZoneCategory('Crose Gorge', 'royalBlue')).toBe('Fort Sterling RC');
      expect(getZoneCategory('Caulder Fissure', 'royalBlue')).toBe('Fort Sterling RC');
      // Portal
      expect(getZoneCategory('Whitebank Shore', 'outlands')).toBe('Fort Sterling Portal');
      expect(getZoneCategory('Deepwood Dell', 'outlands')).toBe('Fort Sterling Portal');
      expect(getZoneCategory('Meltwater Delta', 'outlands')).toBe('Fort Sterling Portal');
    });
  });
});
