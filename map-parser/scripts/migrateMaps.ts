import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZoneNameParser } from '../src/ZoneNameParser.js';
import { GameMapSchema, type GameMap } from '../src/types.js';

var __dirname = dirname(fileURLToPath(import.meta.url));
var MAPS_PATH = resolve(__dirname, '../../web/shared/data/maps.json');

async function migrate() {
  var rawData = readFileSync(MAPS_PATH, 'utf8');
  var maps = JSON.parse(rawData) as any[];

  var totalProcessed = 0;
  var unknownShapes = 0;
  var nullGuaranteedContent = 0;
  var socketCountMin = 0;
  var failures: { mapID: string; reason: string }[] = [];

  var migratedMaps = maps.map((entry) => {
    try {
      var shape = ZoneNameParser.parseMapShape(entry);
      var socketInfo = ZoneNameParser.resolveSocketInfo(shape);
      var guaranteedContent = ZoneNameParser.parseGuaranteedContent(entry);

      var updatedEntry: any = {
        ...entry,
        mapShape: shape,
        socketCount: socketInfo.socketCount,
        largeSocketCount: socketInfo.largeSocketCount,
        smallSocketCount: socketInfo.smallSocketCount,
        socketCountIsMinimum: socketInfo.socketCountIsMinimum,
        guaranteedContent: guaranteedContent,
      };

      if (updatedEntry.mapType === 'roads' || updatedEntry.mapType === 'roadsHideout') {
        updatedEntry.mapType = 'roads';
        if (shape === 'rest') {
          updatedEntry.isRoadsHideout = true;
        } else {
          delete updatedEntry.isRoadsHideout;
        }
      }

      // Validate
      var result = GameMapSchema.safeParse(updatedEntry);
      if (!result.success) {
        failures.push({ mapID: entry.mapID, reason: result.error.message });
        return entry;
      }

      totalProcessed++;
      if (shape === 'unknown') unknownShapes++;
      if (guaranteedContent === null && !ZoneNameParser.isAvalonianRest(entry)) {
        nullGuaranteedContent++;
      }
      if (socketInfo.socketCountIsMinimum) socketCountMin++;

      return result.data;
    } catch (e: any) {
      failures.push({ mapID: entry.mapID, reason: e.message });
      return entry;
    }
  });

  if (failures.length > 0) {
    console.error('Migration encountered failures:');
    failures.forEach(f => console.error(`  - ${f.mapID}: ${f.reason}`));
    process.exit(1);
  }

  writeFileSync(MAPS_PATH, JSON.stringify(migratedMaps, null, 2) + '\n', 'utf8');

  console.log('Migration summary:');
  console.log(`- Total zones processed: ${totalProcessed}`);
  console.log(`- Zones where mapShape is "unknown": ${unknownShapes}`);
  console.log(`- Zones where guaranteedContent is null (excluding Rests): ${nullGuaranteedContent}`);
  console.log(`- Zones where socketCountIsMinimum is true: ${socketCountMin}`);
}

migrate().catch(console.error);
