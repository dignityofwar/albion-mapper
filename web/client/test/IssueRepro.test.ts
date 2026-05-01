import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach } from 'vitest';
import { useRoomStore } from '@/stores/useRoomStore';

describe('Issue Reproduction', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should not expire parent node if child connection is expired but path to hideout still exists', () => {
    const store = useRoomStore();
    const homeZoneId = 'qiient-in-odetum';
    store.homeZoneId = homeZoneId;
    
    const fetosZoneId = 'fetos-aiaylos';
    const oorosZoneId = 'ooros-ataltum';
    
    const now = Date.now();
    
    // Connection: Home -> Fetos (valid)
    const conn1 = {
      id: 'conn1',
      roomId: 'room1',
      fromZoneId: homeZoneId,
      toZoneId: fetosZoneId,
      expiresAt: new Date(now + 100000).toISOString(),
      reportedAt: new Date().toISOString(),
      isExpired: false
    };
    
    // Connection: Fetos -> Ooros (expired)
    const conn2 = {
      id: 'conn2',
      roomId: 'room1',
      fromZoneId: fetosZoneId,
      toZoneId: oorosZoneId,
      expiresAt: new Date(now - 1000).toISOString(),
      reportedAt: new Date().toISOString(),
      isExpired: true
    };
    
    store.connections = [conn1, conn2];
    
    // Verify fetos is NOT expired
    // The issue says: "it did not isolate the other connections that Fetos has."
    // and "looking at the data for fetos it doesn't appear to be expired."
    // So isNodeExpired(fetos) should return false.
    
    expect(store.isNodeExpired(fetosZoneId, now)).toBe(false);
  });
});
