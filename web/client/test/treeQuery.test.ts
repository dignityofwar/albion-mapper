
import { describe, it, expect } from 'vitest';
import { treeQuery } from '../src/utils/treeQuery';
import type { Connection } from 'shared';

describe('treeQuery', () => {
  const connections: Connection[] = [
    { id: 'c1', roomId: 'room1', fromZoneId: 'z1', toZoneId: 'z2', expiresAt: new Date(Date.now() + 10000).toISOString(), reportedAt: new Date().toISOString(), isExpired: false },
    { id: 'c2', roomId: 'room1', fromZoneId: 'z2', toZoneId: 'z3', expiresAt: new Date(Date.now() + 10000).toISOString(), reportedAt: new Date().toISOString(), isExpired: false },
    { id: 'c3', roomId: 'room1', fromZoneId: 'z3', toZoneId: 'z4', expiresAt: new Date(Date.now() + 10000).toISOString(), reportedAt: new Date().toISOString(), isExpired: false },
  ];

  it('should find ancestors', () => {
    const ancestors = treeQuery('c3', connections, 'ancestors');
    expect(ancestors.map(a => a.id)).toContain('c2');
    expect(ancestors.map(a => a.id)).toContain('c1');
  });
});
