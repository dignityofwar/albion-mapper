import { describe, it, expect } from 'vitest';
import { gridLayout } from '../src/utils/gridLayout.js';
import type { Connection } from 'shared';

const HOME = 'qiient-in-odetum';
const ZONE_A = 'adrens-hill';
const ZONE_B = 'anklesnag-mire';

function makeConn(from: string, to: string): Connection {
  return {
    id: crypto.randomUUID(),
    roomId: 'room1',
    fromZoneId: from,
    toZoneId: to,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    reportedAt: new Date().toISOString(),
  };
}

describe('gridLayout', () => {
  it('places home zone at (0, 0)', () => {
    const positions = gridLayout(HOME, []);
    const home = positions.find((p) => p.id === HOME);
    expect(home).toBeDefined();
    expect(home!.x).toBe(0);
    expect(home!.y).toBe(0);
  });

  it('places direct neighbours on grid', () => {
    const conn = makeConn(HOME, ZONE_A);
    const positions = gridLayout(HOME, [conn]);
    const neighbour = positions.find((p) => p.id === ZONE_A);
    expect(neighbour).toBeDefined();
    // Verify it is on the grid
    expect(Math.abs(neighbour!.x)).toBe(300);
  });

  it('places second-degree neighbours above the parent', () => {
    // HOME - ZONE_A - ZONE_B
    const conn1 = makeConn(HOME, ZONE_A);
    const conn2 = makeConn(ZONE_A, ZONE_B);
    const positions = gridLayout(HOME, [conn1, conn2]);
    const zoneA = positions.find((p) => p.id === ZONE_A)!;
    const zoneB = positions.find((p) => p.id === ZONE_B)!;

    // ZONE_A should be at y=0 (neighbor of HOME)
    // ZONE_B should be above ZONE_A (y < zoneA.y)
    expect(zoneA.y).toBe(0);
    expect(zoneB.y).toBeLessThan(zoneA.y);
  });

  it('places multiple neighbours of home zone at distinct positions', () => {
    const conn1 = makeConn(HOME, 'A');
    const conn2 = makeConn(HOME, 'B');
    const conn3 = makeConn(HOME, 'C');
    const positions = gridLayout(HOME, [conn1, conn2, conn3]);
    const posA = positions.find((p) => p.id === 'A')!;
    const posB = positions.find((p) => p.id === 'B')!;
    const posC = positions.find((p) => p.id === 'C')!;
    
    const coords = new Set([`${posA.x},${posA.y}`, `${posB.x},${posB.y}`, `${posC.x},${posC.y}`]);
    expect(coords.size).toBe(3);
  });
});
