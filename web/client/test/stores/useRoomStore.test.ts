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
      nodePositions: [{ zoneId: 'home', x: 0, y: 0 }, { zoneId: 'b', x: 10, y: 10 }]
    });

    store.applyMessage({ type: 'room_reset' });

    expect(store.connections).toHaveLength(0);
    expect(store.nodePositions).toHaveLength(1);
    expect(store.nodePositions[0].zoneId).toBe('home');
  });
});
