import { describe, it, expect } from 'vitest';
import { radialLayout } from '../src/utils/radialLayout.js';
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

describe('radialLayout', () => {
  it('places home zone at (0, 0)', () => {
    const positions = radialLayout(HOME, []);
    const home = positions.find((p) => p.id === HOME);
    expect(home).toBeDefined();
    expect(home!.x).toBe(0);
    expect(home!.y).toBe(0);
  });

  it('returns only home node when there are no connections', () => {
    const positions = radialLayout(HOME, []);
    expect(positions).toHaveLength(1);
    expect(positions[0].id).toBe(HOME);
  });

  it('places direct neighbours at radius ~220', () => {
    const conn = makeConn(HOME, ZONE_A);
    const positions = radialLayout(HOME, [conn]);
    const neighbour = positions.find((p) => p.id === ZONE_A);
    expect(neighbour).toBeDefined();
    const dist = Math.sqrt(neighbour!.x ** 2 + neighbour!.y ** 2);
    expect(dist).toBeCloseTo(220, 0);
  });

  it('places second-degree neighbours at radius ~440', () => {
    const conn1 = makeConn(HOME, ZONE_A);
    const conn2 = makeConn(ZONE_A, ZONE_B);
    const positions = radialLayout(HOME, [conn1, conn2]);
    const second = positions.find((p) => p.id === ZONE_B);
    expect(second).toBeDefined();
    const dist = Math.sqrt(second!.x ** 2 + second!.y ** 2);
    expect(dist).toBeCloseTo(440, 0);
  });

  it('returns deterministic positions for same input', () => {
    const conns = [makeConn(HOME, ZONE_A), makeConn(HOME, ZONE_B)];
    const pos1 = radialLayout(HOME, conns);
    const pos2 = radialLayout(HOME, conns);
    pos1.forEach((p, i) => {
      expect(p.x).toBe(pos2[i].x);
      expect(p.y).toBe(pos2[i].y);
    });
  });

  it('handles connection in either direction (to/from home)', () => {
    const conn = makeConn(ZONE_A, HOME); // reversed direction
    const positions = radialLayout(HOME, [conn]);
    const neighbour = positions.find((p) => p.id === ZONE_A);
    expect(neighbour).toBeDefined();
    const dist = Math.sqrt(neighbour!.x ** 2 + neighbour!.y ** 2);
    expect(dist).toBeCloseTo(220, 0);
  });
});
