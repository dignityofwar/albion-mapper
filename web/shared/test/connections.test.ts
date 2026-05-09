import { describe, it, expect } from 'vitest';
import { wouldCreateCycle, wouldCreateLongerLoop } from '../src/connections.js';
import type { Connection } from '../src/types.js';

function makeConn(fromZoneId: string, toZoneId: string): Connection {
  return {
    id: `${fromZoneId}->${toZoneId}`,
    roomId: 'test-room',
    fromZoneId,
    toZoneId,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    reportedAt: new Date().toISOString(),
  };
}

describe('wouldCreateCycle', () => {
  it('returns false when there are no connections', () => {
    expect(wouldCreateCycle([], 'A', 'B')).toBe(false);
  });

  it('returns true for a direct 2-zone cycle (A→B when B→A exists)', () => {
    const connections = [makeConn('B', 'A')];
    expect(wouldCreateCycle(connections, 'A', 'B')).toBe(true);
  });

  it('returns false for a 3-zone loop (A→B→C, adding C→A)', () => {
    const connections = [makeConn('A', 'B'), makeConn('B', 'C')];
    expect(wouldCreateCycle(connections, 'C', 'A')).toBe(false);
  });

  it('returns false for unrelated connections', () => {
    const connections = [makeConn('X', 'Y'), makeConn('Y', 'Z')];
    expect(wouldCreateCycle(connections, 'A', 'B')).toBe(false);
  });
});

describe('wouldCreateLongerLoop', () => {
  it('returns false when there are no connections', () => {
    expect(wouldCreateLongerLoop([], 'A', 'B')).toBe(false);
  });

  it('returns false for a simple chain with no loop (A→B, adding B→C)', () => {
    const connections = [makeConn('A', 'B')];
    expect(wouldCreateLongerLoop(connections, 'B', 'C')).toBe(false);
  });

  it('returns true for a 3-zone loop (A→B→C, adding C→A)', () => {
    const connections = [makeConn('A', 'B'), makeConn('B', 'C')];
    expect(wouldCreateLongerLoop(connections, 'C', 'A')).toBe(true);
  });

  it('returns true for the issue scenario: qiient-in-odetum→hasos-agoitum→secent-al-duosom, adding secent-al-duosom→qiient-in-odetum', () => {
    const connections = [
      makeConn('qiient-in-odetum', 'hasos-agoitum'),
      makeConn('hasos-agoitum', 'secent-al-duosom'),
    ];
    expect(wouldCreateLongerLoop(connections, 'secent-al-duosom', 'qiient-in-odetum')).toBe(true);
  });

  it('returns true for a direct 2-zone cycle too (superset of wouldCreateCycle)', () => {
    const connections = [makeConn('B', 'A')];
    expect(wouldCreateLongerLoop(connections, 'A', 'B')).toBe(true);
  });

  it('returns false for unrelated connections', () => {
    const connections = [makeConn('X', 'Y'), makeConn('Y', 'Z')];
    expect(wouldCreateLongerLoop(connections, 'A', 'B')).toBe(false);
  });
});
