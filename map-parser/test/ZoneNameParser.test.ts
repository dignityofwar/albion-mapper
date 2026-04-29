import { describe, it, expect } from 'vitest';
import { ZoneNameParser } from '../src/ZoneNameParser.js';
import { type GameMap } from '../src/types.js';

describe('ZoneNameParser', () => {
  describe('parseMapShape', () => {
    it('should return "h" for name beginning with H', () => {
      var zone = { mapName: 'Horos-In-Aum', mapID: 'horos-in-aum' } as GameMap;
      expect(ZoneNameParser.parseMapShape(zone)).toBe('h');
    });

    it('should return "x" for name beginning with X', () => {
      var zone = { mapName: 'Xeros-In-Aum', mapID: 'xeros-in-aum' } as GameMap;
      expect(ZoneNameParser.parseMapShape(zone)).toBe('x');
    });

    it('should NOT return "rest" if isRoadsHideout is true but name is regular', () => {
      var zone = { mapName: 'Horos-In-Aum', mapID: 'horos-in-aum', isRoadsHideout: true } as GameMap;
      expect(ZoneNameParser.parseMapShape(zone)).toBe('h');
    });

    it('should return "rest" for name beginning with Qii', () => {
      var zone = { mapName: 'Qiient-In-Odetum', mapID: 'qiient-in-odetum' } as GameMap;
      expect(ZoneNameParser.parseMapShape(zone)).toBe('rest');
    });

    it('should return "unknown" for unrecognised first letter', () => {
      var zone = { mapName: 'Zoros-In-Aum', mapID: 'zoros-in-aum' } as GameMap;
      expect(ZoneNameParser.parseMapShape(zone)).toBe('unknown');
    });
  });

  describe('parseGuaranteedContent', () => {
    it('should return LargeGreenChest for name ending -los', () => {
      var zone = { mapName: 'Cases-Ugumlos' } as GameMap;
      var result = ZoneNameParser.parseGuaranteedContent(zone);
      expect(result).toEqual({ type: 'LargeGreenChest', category: 'chest' });
    });

    it('should return null for resource-based suffix (e.g., -aum)', () => {
      var zone = { mapName: 'Horos-In-Aum' } as GameMap;
      expect(ZoneNameParser.parseGuaranteedContent(zone)).toBeNull();
    });

    it('should return null for Avalonian Rest (prefix match)', () => {
      var zone = { mapName: 'Qiient-In-Odetum' } as GameMap;
      expect(ZoneNameParser.parseGuaranteedContent(zone)).toBeNull();
    });

    it('should return null for unrecognised suffix', () => {
      var zone = { mapName: 'Horos-In-Abc' } as GameMap;
      expect(ZoneNameParser.parseGuaranteedContent(zone)).toBeNull();
    });
  });

  describe('resolveSocketInfo', () => {
    it('should return correct info for each shape', () => {
        var shapes = ['c', 'f', 'h', 'o', 'p', 's', 't', 'x', 'rest'];
        shapes.forEach(shape => {
            var info = ZoneNameParser.resolveSocketInfo(shape);
            expect(info.socketCount).toBeGreaterThan(0);
        });
    });

    it('should set socketCountIsMinimum correctly', () => {
        expect(ZoneNameParser.resolveSocketInfo('c').socketCountIsMinimum).toBe(false);
        expect(ZoneNameParser.resolveSocketInfo('f').socketCountIsMinimum).toBe(true);
        expect(ZoneNameParser.resolveSocketInfo('h').socketCountIsMinimum).toBe(false);
        expect(ZoneNameParser.resolveSocketInfo('o').socketCountIsMinimum).toBe(true);
        expect(ZoneNameParser.resolveSocketInfo('p').socketCountIsMinimum).toBe(true);
        expect(ZoneNameParser.resolveSocketInfo('s').socketCountIsMinimum).toBe(false);
        expect(ZoneNameParser.resolveSocketInfo('t').socketCountIsMinimum).toBe(true);
        expect(ZoneNameParser.resolveSocketInfo('x').socketCountIsMinimum).toBe(true);
        expect(ZoneNameParser.resolveSocketInfo('rest').socketCountIsMinimum).toBe(false);
    });

    it('should return 2/2/4 for rest', () => {
        var info = ZoneNameParser.resolveSocketInfo('rest');
        expect(info.largeSocketCount).toBe(2);
        expect(info.smallSocketCount).toBe(2);
        expect(info.socketCount).toBe(4);
        expect(info.socketCountIsMinimum).toBe(false);
    });

    it('should return zeros for unknown', () => {
        var info = ZoneNameParser.resolveSocketInfo('unknown');
        expect(info.largeSocketCount).toBe(0);
        expect(info.smallSocketCount).toBe(0);
        expect(info.socketCount).toBe(0);
        expect(info.socketCountIsMinimum).toBe(false);
    });
  });
});
