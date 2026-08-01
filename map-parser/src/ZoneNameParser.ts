import { type GameMap, type GuaranteedContent } from './types.js';

export interface ZoneSocketInfo {
  largeSocketCount: number;
  smallSocketCount: number;
  socketCount: number;
}

export class ZoneNameParser {
  // Names that match one of the Avalonian Rest prefixes below but are regular
  // roads maps, not roads hideouts.
  private static readonly NON_HIDEOUT_PREFIX_MATCHES = new Set([
    'Setos-Aiaitum',
    'Setitos-Obobrom',
    'Setos-Avamsum',
  ]);

  // Maps whose layout doesn't match their name's first letter, confirmed against
  // the in-game map. Without this the sync would keep reverting them.
  private static readonly SHAPE_OVERRIDES = new Map<string, string>([
    ['Cieos-Atatlum', 'o'],
    ['Cynitos-Atatlum', 'o'],
  ]);

  public static isAvalonianRest(zone: GameMap): boolean {
    var name = zone.mapName;
    if (this.NON_HIDEOUT_PREFIX_MATCHES.has(name)) {
      return false;
    }
    var prefixes = ['Qua', 'Qii', 'Sec', 'Set'];
    return prefixes.some(prefix => name.startsWith(prefix));
  }

  public static parseMapShape(zone: GameMap): string {
    var override = this.SHAPE_OVERRIDES.get(zone.mapName);
    if (override) {
      return override;
    }

    if (this.isAvalonianRest(zone)) {
      return 'rest';
    }

    var firstChar = zone.mapName.charAt(0).toLowerCase();
    var validShapes = new Set(['c', 'f', 'h', 'o', 'p', 's', 't', 'x']);

    if (validShapes.has(firstChar)) {
      return firstChar;
    }

    console.warn(`[warn] Unrecognised map shape for mapID "${zone.mapID}": "${firstChar}"`);
    return 'unknown';
  }

  public static parseGuaranteedContent(zone: GameMap): GuaranteedContent | null {
    if (this.isAvalonianRest(zone)) {
      return null;
    }

    var name = zone.mapName.toLowerCase();
    var segments = name.split('-');
    var lastSegment = segments[segments.length - 1];
    
    if (lastSegment.endsWith('los')) return { type: 'LargeGreenChest', category: 'chest' };
    if (lastSegment.endsWith('am')) return { type: 'LargeBlueChest', category: 'chest' };
    if (lastSegment.endsWith('un')) return { type: 'LargeGoldChest', category: 'chest' };

    return null;
  }

  public static resolveSocketInfo(mapShape: string): ZoneSocketInfo {
    switch (mapShape.toLowerCase()) {
      case 'c':
        return { largeSocketCount: 2, smallSocketCount: 6, socketCount: 8 };
      case 'f':
        return { largeSocketCount: 2, smallSocketCount: 6, socketCount: 8 };
      case 'h':
        return { largeSocketCount: 2, smallSocketCount: 6, socketCount: 8 };
      case 'o':
        return { largeSocketCount: 1, smallSocketCount: 7, socketCount: 8 };
      case 'p':
        return { largeSocketCount: 1, smallSocketCount: 7, socketCount: 8 };
      case 's':
        return { largeSocketCount: 2, smallSocketCount: 6, socketCount: 8 };
      case 't':
        return { largeSocketCount: 3, smallSocketCount: 5, socketCount: 8 };
      case 'x':
        return { largeSocketCount: 3, smallSocketCount: 5, socketCount: 8 };
      case 'rest':
        return { largeSocketCount: 2, smallSocketCount: 2, socketCount: 4 };
      default:
        if (mapShape !== 'unknown') {
            console.warn(`[warn] Unrecognised map shape for socket info resolution: "${mapShape}"`);
        }
        return { largeSocketCount: 0, smallSocketCount: 0, socketCount: 0 };
    }
  }
}
