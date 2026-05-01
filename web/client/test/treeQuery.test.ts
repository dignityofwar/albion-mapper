import { describe, it, expect } from 'vitest';
import { treeQuery } from '../src/utils/treeQuery';
import { Connection } from 'shared';

describe('treeQuery', () => {
  const connections: Connection[] = [
    { id: '1', roomId: 'r1', fromZoneId: 'A', toZoneId: 'B', expiresAt: '2026-05-01T03:00:00Z', reportedAt: '2026-05-01T02:00:00Z' },
    { id: '2', roomId: 'r1', fromZoneId: 'B', toZoneId: 'C', expiresAt: '2026-05-01T03:00:00Z', reportedAt: '2026-05-01T02:00:00Z' },
    { id: '3', roomId: 'r1', fromZoneId: 'C', toZoneId: 'D', expiresAt: '2026-05-01T03:00:00Z', reportedAt: '2026-05-01T02:00:00Z' },
  ];

  it('finds ancestors', () => {
    const ancestors = treeQuery('3', connections, 'ancestors');
    const ids = ancestors.map(a => a.id);
    expect(ids).toContain('2');
    expect(ids).toContain('1');
  });

  it('finds descendants', () => {
    const descendants = treeQuery('1', connections, 'descendants');
    const ids = descendants.map(d => d.id);
    expect(ids).toContain('2');
    expect(ids).toContain('3');
  });
});
