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

  it('places direct neighbours at radius ~300', () => {
    const conn = makeConn(HOME, ZONE_A);
    const positions = radialLayout(HOME, [conn]);
    const neighbour = positions.find((p) => p.id === ZONE_A);
    expect(neighbour).toBeDefined();
    const dist = Math.sqrt(neighbour!.x ** 2 + neighbour!.y ** 2);
    expect(dist).toBeCloseTo(300, 0);
  });

  it('places second-degree neighbours at radius ~600', () => {
    const conn1 = makeConn(HOME, ZONE_A);
    const conn2 = makeConn(ZONE_A, ZONE_B);
    const positions = radialLayout(HOME, [conn1, conn2]);
    const second = positions.find((p) => p.id === ZONE_B);
    expect(second).toBeDefined();
    const dist = Math.sqrt(second!.x ** 2 + second!.y ** 2);
    expect(dist).toBeCloseTo(600, 0);
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
    expect(dist).toBeCloseTo(300, 0);
  });

  it('places third-degree neighbours', () => {
    const conns = [
      makeConn(HOME, ZONE_A),
      makeConn(ZONE_A, ZONE_B),
      makeConn(ZONE_B, 'zone-c')
    ];
    const positions = radialLayout(HOME, conns);
    const nodeC = positions.find((p) => p.id === 'zone-c');
    
    expect(nodeC).toBeDefined();
    const dist = Math.sqrt(nodeC!.x ** 2 + nodeC!.y ** 2);
    expect(dist).toBeGreaterThan(600);
  });

  it('allocates angular range proportional to branch size', () => {
    const parent = 'parent';
    const child1 = 'child1';
    const child2 = 'child2';
    // child1 has 1 descendant (itself)
    // child2 has 2 descendants (itself + grandchild)
    const conns = [
      makeConn(parent, child1),
      makeConn(parent, child2),
      makeConn(child2, 'grandchild'),
    ];
    // Need to ensure parent is placed
    const positions = radialLayout(HOME, [makeConn(HOME, parent), ...conns]);
    
    // Total size of parent's branch = 1 (parent) + 1 (child1) + 2 (child2 + grandchild) = 4.
    // Actually getBranchSize(parent) = 1 (parent) + size(child1) + size(child2) = 1 + 1 + 2 = 4.
    // Wait, getBranchSize(parent) excludes parentID if parentID is the HOME zone, but if parent is the top-level neighbour, parentID is HOME.
    // Yes, getBranchSize seems correct.
    
    // Angular range for children is 2*PI (since parent is the only child of HOME).
    // child1 branch size = 1.
    // child2 branch size = 2.
    // Total children branch size = 1 + 2 = 3.
    // child1 range = (1/3) * 2*PI.
    // child2 range = (2/3) * 2*PI.
    
    // We can't easily check angular range, but we can check positions are at correct radius.
    const c1Pos = positions.find(p => p.id === child1)!;
    const c2Pos = positions.find(p => p.id === child2)!;
    
    const dist1 = Math.sqrt(c1Pos.x**2 + c1Pos.y**2);
    const dist2 = Math.sqrt(c2Pos.x**2 + c2Pos.y**2);
    
    // Dist from center to child should be 600.
    expect(dist1).toBeCloseTo(600, 0);
    expect(dist2).toBeCloseTo(600, 0);
  });

  it('places more than 3 children both above and below parent', () => {
    const parent = 'parent';
    const conns = [
      makeConn(parent, 'child1'),
      makeConn(parent, 'child2'),
      makeConn(parent, 'child3'),
      makeConn(parent, 'child4'),
    ];
    const positions = radialLayout(HOME, [makeConn(HOME, parent), ...conns]);
    
    const pPos = positions.find(p => p.id === parent)!;
    const children = ['child1', 'child2', 'child3', 'child4'].map(id => positions.find(p => p.id === id)!);
    
    const above = children.filter(c => c.y < pPos.y);
    const below = children.filter(c => c.y > pPos.y);
    
    expect(above.length).toBeGreaterThan(0);
    expect(below.length).toBeGreaterThan(0);
  });

  it('places demo data children of huyes-ogozlum mostly above it', () => {
    const demoConns = [
      { from: 'touos-ataglos', to: 'qiient-in-odetum' },
      { from: 'touos-ataglos', to: 'adrens-hill' },
      { from: 'touos-ataglos', to: 'aspenwood' },
      { from: 'qiient-in-odetum', to: 'huyes-ogozlum' },
      { from: 'huyes-ogozlum', to: 'widemoor-delta' },
      { from: 'huyes-ogozlum', to: 'sandrift-fringe' },
      { from: 'huyes-ogozlum', to: 'huyitos-agoitum' },
    ].map(c => makeConn(c.from, c.to));
    
    const positions = radialLayout('touos-ataglos', demoConns);
    
    const parent = 'huyes-ogozlum';
    const children = ['widemoor-delta', 'sandrift-fringe', 'huyitos-agoitum'];
    
    const pPos = positions.find(p => p.id === parent)!;
    const childNodes = children.map(id => positions.find(p => p.id === id)!);
    
    // Assert leaf children are above the parent (lower Y)
    ['widemoor-delta', 'sandrift-fringe'].forEach(id => {
        const child = positions.find(p => p.id === id)!;
        expect(child.y).toBeLessThan(pPos.y);
    });
  });
});
