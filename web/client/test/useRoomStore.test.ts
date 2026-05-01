import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach } from 'vitest';
import { useRoomStore } from '@/stores/useRoomStore';

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

  it('should NOT update lastUpdate when node positions are updated (default reason)', () => {
    const store = useRoomStore();
    const initialDate = new Date('2026-04-28T10:00:00Z');
    store.lastUpdate = initialDate;
    
    store.updateNodePositionsInStore([{ zoneId: 'z1', x: 100, y: 100 }]);
    
    expect(store.lastUpdate).toBe(initialDate);
  });

  it('should NOT update lastUpdate when node_positions_updated message is received without flag', () => {
    const store = useRoomStore();
    const initialDate = new Date('2026-04-28T10:00:00Z');
    store.lastUpdate = initialDate;
    
    store.applyMessage({
      type: 'node_positions_updated',
      nodePositions: [{ zoneId: 'z1', x: 100, y: 100 }]
    });
    
    expect(store.lastUpdate).toBe(initialDate);
  });

  it('should update lastUpdate when updateNodeFeatures is called', () => {
    const store = useRoomStore();
    const initialDate = new Date('2026-04-28T10:00:00Z');
    store.lastUpdate = initialDate;
    store.nodePositions = [{ zoneId: 'z1', x: 0, y: 0 }];
    
    store.updateNodeFeatures('z1', { reds: 5 });
    
    expect(store.lastUpdate).not.toBe(initialDate);
  });

  it('should update lastUpdate when node_positions_updated message is received with updateLastUpdated flag', () => {
    const store = useRoomStore();
    const initialDate = new Date('2026-04-28T10:00:00Z');
    store.lastUpdate = initialDate;
    
    store.applyMessage({
      type: 'node_positions_updated',
      nodePositions: [{ zoneId: 'z1', x: 100, y: 100 }],
      updateLastUpdated: true
    });
    
    expect(store.lastUpdate).not.toBe(initialDate);
  });

  it('should set wsStatus to auth_failed when close code is 4401', () => {
    const store = useRoomStore();
    
    // Mock WebSocket with addEventListener support
    let closeHandler: any;
    (global as any).WebSocket = class {
      static OPEN = 1;
      readyState = 1;
      send() {}
      close() {}
      addEventListener(type: string, handler: any) {
        if (type === 'close') closeHandler = handler;
      }
      removeEventListener() {}
    };

    store.roomId = 'room1';
    store.token = 'token1';
    store.connect();
    
    closeHandler({ code: 4401 });
    
    expect(store.wsStatus).toBe('auth_failed');
  });

  it('should never restrict home zone', () => {
    const store = useRoomStore();
    store.homeZoneId = 'home-zone';
    
    // Add an expired connection
    const now = Date.now();
    store.connections = [{
      id: 'conn1',
      roomId: 'room1',
      fromZoneId: 'home-zone',
      toZoneId: 'other-zone',
      expiresAt: new Date(now - 1000).toISOString(),
      reportedAt: new Date().toISOString()
    }];
    
    // Verify home zone is not restricted
    expect(store.isNodeRestricted('home-zone', Date.now())).toBe(false);
  });
});
