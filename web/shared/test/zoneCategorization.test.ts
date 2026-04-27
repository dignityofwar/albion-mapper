import { describe, it, expect } from 'vitest';
import { getZoneCategory } from '../src/zones.js';

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
        expect(getZoneCategory('Birken Fell', 'royalRed')).toBe('Martlock RC');
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
        expect(getZoneCategory('Wyre Forest', 'royalRed')).toBe('Lymhurst RC');
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

    describe('Fort Stirling RC', () => {
      it('categorizes by keywords/prefixes: Fissure, Gorge, Camain, Pen, Creag, Cairn', () => {
        expect(getZoneCategory('Deadvein Fissure', 'royalRed')).toBe('Fort Stirling RC');
        expect(getZoneCategory('Bryn Gorge', 'royalBlue')).toBe('Fort Stirling RC');
        expect(getZoneCategory('Cairn Camain', 'royalYellow')).toBe('Fort Stirling RC');
        expect(getZoneCategory('Pen Digra', 'royalRed')).toBe('Fort Stirling RC');
        expect(getZoneCategory('Creag Garr', 'royalRed')).toBe('Fort Stirling RC');
      });

      it('handles exceptions: Cedar Copse, Larchroad', () => {
        expect(getZoneCategory('Cedar Copse', 'royalBlue')).toBe('Fort Stirling RC');
        expect(getZoneCategory('Cedarcopse', 'royalBlue')).toBe('Fort Stirling RC');
        expect(getZoneCategory('Larchroad', 'royalRed')).toBe('Fort Stirling RC');
      });
    });
  });

  describe('Outlands Portals', () => {
    it('categorizes portals correctly', () => {
      expect(getZoneCategory('Thetford Portal', 'outlands')).toBe('Thetford Portal');
      expect(getZoneCategory('Fort Stirling Portal', 'outlands')).toBe('Fort Stirling Portal');
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
      expect(getZoneCategory('Willowshade Hills', 'outlands')).toBe('Thetford Portal');

      // Martlock
      expect(getZoneCategory('Windgrass Fields', 'outlands')).toBe('Martlock Portal');
      expect(getZoneCategory('Mudfoot Sump', 'outlands')).toBe('Martlock Portal');
      expect(getZoneCategory('Bleachskull Steppe', 'outlands')).toBe('Martlock Portal');
      expect(getZoneCategory('Frostbite Mountain', 'outlands')).toBe('Martlock Portal');

      // Bridgewatch
      expect(getZoneCategory('Sandrift', 'outlands')).toBe('Bridgewatch Portal');
      expect(getZoneCategory('Farshore Bay', 'outlands')).toBe('Bridgewatch Portal');

      // Lymhurst
      expect(getZoneCategory('Hightree Lake', 'outlands')).toBe('Lymhurst Portal');
      expect(getZoneCategory('Watchwood', 'outlands')).toBe('Lymhurst Portal');

      // Fort Stirling
      expect(getZoneCategory('Whitebank Wall', 'outlands')).toBe('Fort Stirling Portal');
      expect(getZoneCategory('Deepwood Gorge', 'outlands')).toBe('Fort Stirling Portal');
      expect(getZoneCategory('Frostpeak Ascent', 'outlands')).toBe('Fort Stirling Portal');
      expect(getZoneCategory('Meltwater Delta', 'outlands')).toBe('Fort Stirling Portal');
    });

    it('categorizes keyword-based outlands zones as portals', () => {
      expect(getZoneCategory('Widemoor Fen', 'outlands')).toBe('Thetford Portal');
      expect(getZoneCategory('Willowshade Hills', 'outlands')).toBe('Thetford Portal');
      expect(getZoneCategory('Battlebrae Meadow', 'outlands')).toBe('Bridgewatch Portal');
      expect(getZoneCategory('Southgrove Wood', 'outlands')).toBe('Lymhurst Portal');
      expect(getZoneCategory('Deepwood Gorge', 'outlands')).toBe('Fort Stirling Portal');
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

  describe('Spot Checks from User', () => {
    it('Thetford', () => {
      // Portal
      expect(getZoneCategory('Willowshade Pools', 'outlands')).toBe('Thetford Portal');
      expect(getZoneCategory('Willowshade Shore', 'outlands')).toBe('Thetford Portal');
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

    it('Fort Stirling', () => {
      // City
      expect(getZoneCategory('Pen Gent', 'royalBlue')).toBe('Fort Stirling RC');
      expect(getZoneCategory('Crose Gorge', 'royalBlue')).toBe('Fort Stirling RC');
      expect(getZoneCategory('Caulder Fissure', 'royalBlue')).toBe('Fort Stirling RC');
      // Portal
      expect(getZoneCategory('Whitebank Shore', 'outlands')).toBe('Fort Stirling Portal');
      expect(getZoneCategory('Deepwood Dell', 'outlands')).toBe('Fort Stirling Portal');
      expect(getZoneCategory('Meltwater Delta', 'outlands')).toBe('Fort Stirling Portal');
    });
  });
});
