import mapsData from '../data/maps.json' assert { type: 'json' };
import { type GameMap } from './types.js';

export const MAPS: GameMap[] = mapsData as GameMap[];
