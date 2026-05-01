import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach } from 'vitest';
import { useRoomStore } from '../../src/stores/useRoomStore';

describe('useRoomStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('has updateNodePositions method', () => {
    const store = useRoomStore();
    expect(typeof store.updateNodePositionsInStore).toBe('function');
  });

  it('applies room_reset — clears connections and keeps only home node position', () => {
    const store = useRoomStore();
    store.applyMessage({
      type: 'sync',
      connections: [{ id: 'c1', roomId: 'r1', fromZoneId: 'a', toZoneId: 'b', expiresAt: new Date().toISOString(), reportedAt: new Date().toISOString() }],
      homeZoneId: 'home',
      nodePositions: [{ zoneId: 'home', x: 0, y: 0 }, { zoneId: 'b', x: 10, y: 10 }],
      lastUpdatedAt: new Date().toISOString()
    });

    store.applyMessage({ type: 'room_reset' });

    expect(store.connections).toHaveLength(0);
    expect(store.nodePositions).toHaveLength(1);
    expect(store.nodePositions[0].zoneId).toBe('home');
  });

  it('marks a node as restricted when connection expires', () => {
    const store = useRoomStore();
    const now = Date.now();
    const expiresAt = new Date(now + 2000).toISOString();
    
    store.applyMessage({
      type: 'sync',
      connections: [{ id: 'c1', roomId: 'r1', fromZoneId: 'home', toZoneId: 'a', expiresAt, reportedAt: new Date().toISOString() }],
      homeZoneId: 'home',
      nodePositions: [{ zoneId: 'home', x: 0, y: 0 }, { zoneId: 'a', x: 10, y: 10 }],
      lastUpdatedAt: new Date().toISOString()
    });

    // Check at 1s (before expiry)
    expect(store.isNodeRestricted('a', now + 1000)).toBe(false);

    // Check at 3s (after expiry)
    expect(store.isNodeRestricted('a', now + 3000)).toBe(true);
  });

  it('marks an edge as isolated when parent connection expires', () => {
    const store = useRoomStore();
    const now = Date.now();
    
    // Parent expires in 2s
    const parentExpiresAt = new Date(now + 2000).toISOString();
    // Child expires in 10m
    const childExpiresAt = new Date(now + 600000).toISOString();
    
    store.applyMessage({
      type: 'sync',
      connections: [
        { id: 'parent', roomId: 'r1', fromZoneId: 'home', toZoneId: 'a', expiresAt: parentExpiresAt, reportedAt: new Date().toISOString() },
        { id: 'child', roomId: 'r1', fromZoneId: 'a', toZoneId: 'b', expiresAt: childExpiresAt, reportedAt: new Date().toISOString() }
      ],
      homeZoneId: 'home',
      nodePositions: [{ zoneId: 'home', x: 0, y: 0 }, { zoneId: 'a', x: 10, y: 10 }, { zoneId: 'b', x: 20, y: 20 }],
      lastUpdatedAt: new Date().toISOString()
    });

    // Check at 1s (before expiry)
    expect(store.isEdgeIsolated('child', now + 1000)).toBe(false);

    // Check at 3s (after expiry)
    expect(store.isEdgeIsolated('child', now + 3000)).toBe(true);
  });
});
