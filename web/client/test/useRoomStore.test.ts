import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach } from 'vitest';
import { useRoomStore } from '../src/stores/useRoomStore';

describe('useRoomStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should clear all state when disconnect is called', () => {
    const store = useRoomStore();
    
    // Set some state
    store.connections = [{ 
      id: '1', 
      roomId: 'room1', 
      fromZoneId: 'z1', 
      toZoneId: 'z2', 
      expiresAt: '2026-04-26T18:00:00Z', 
      reportedAt: '2026-04-26T18:00:00Z' 
    }];
    store.homeZoneId = 'zone1';
    store.nodePositions = [{ zoneId: 'zone1', x: 10, y: 10 }];
    // Call disconnect
    store.disconnect();
    
    // Verify state
    expect(store.connections).toEqual([]);
    expect(store.homeZoneId).toBe('');
    expect(store.nodePositions).toEqual([]); // This should fail if not fixed
  });
});
