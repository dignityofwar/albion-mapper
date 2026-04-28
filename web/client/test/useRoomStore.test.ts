import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRoomStore } from '../src/stores/useRoomStore';

// Mock WebSocket
if (typeof global.WebSocket === 'undefined') {
  (global as any).WebSocket = class {
    static OPEN = 1;
    readyState = 1;
    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  };
}

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
    expect(store.nodePositions).toEqual([]);
  });

  it('should update node features and update local state', () => {
    const store = useRoomStore();
    
    // Setup initial state
    store.roomId = 'room1';
    store.token = 'token1';
    store.nodePositions = [
      { zoneId: 'z1', x: 0, y: 0 },
      { zoneId: 'z2', x: 10, y: 10 }
    ];

    const features = { reds: 5, powercoreGreen: true };
    store.updateNodeFeatures('z1', features);

    // Verify local state update (optimistic)
    expect(store.nodePositions[0].features).toEqual(features);
  });
});
