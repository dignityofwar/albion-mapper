import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRoomStore } from '../src/stores/useRoomStore.js';
import type { Connection } from 'shared';

function makeConn(id: string, roomId = 'room1'): Connection {
  return {
    id,
    roomId,
    fromZoneId: 'adrens-hill',
    toZoneId: 'anklesnag-mire',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    reportedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('useRoomStore', () => {
  it('applies sync message — sets connections and homeZoneId', () => {
    const store = useRoomStore();
    const conn = makeConn('c1');
    store.applyMessage({ type: 'sync', connections: [conn], homeZoneId: 'zone-a' });

    expect(store.connections).toHaveLength(1);
    expect(store.connections[0].id).toBe('c1');
    expect(store.homeZoneId).toBe('zone-a');
  });

  it('applies connection_added — adds to list', () => {
    const store = useRoomStore();
    const conn = makeConn('c1');
    store.applyMessage({ type: 'connection_added', connection: conn });

    expect(store.connections).toHaveLength(1);
    expect(store.connections[0].id).toBe('c1');
  });

  it('connection_added is idempotent — duplicate id is a no-op', () => {
    const store = useRoomStore();
    const conn = makeConn('c1');
    store.applyMessage({ type: 'connection_added', connection: conn });
    store.applyMessage({ type: 'connection_added', connection: conn });

    expect(store.connections).toHaveLength(1);
  });

  it('applies connection_removed — removes from list', () => {
    const store = useRoomStore();
    store.applyMessage({ type: 'connection_added', connection: makeConn('c1') });
    store.applyMessage({ type: 'connection_added', connection: makeConn('c2') });
    store.applyMessage({ type: 'connection_removed', connectionId: 'c1' });

    expect(store.connections).toHaveLength(1);
    expect(store.connections[0].id).toBe('c2');
  });

  it('connection_removed for unknown id is a no-op', () => {
    const store = useRoomStore();
    store.applyMessage({ type: 'connection_added', connection: makeConn('c1') });
    store.applyMessage({ type: 'connection_removed', connectionId: 'does-not-exist' });

    expect(store.connections).toHaveLength(1);
  });

  it('applies connection_expired — marks connection as expired', () => {
    const store = useRoomStore();
    store.applyMessage({ type: 'connection_added', connection: makeConn('c1') });
    store.applyMessage({ type: 'connection_expired', connectionId: 'c1' });

    expect(store.connections).toHaveLength(1);
    expect(store.connections[0].isExpired).toBe(true);
  });

  it('applies room_updated — changes homeZoneId', () => {
    const store = useRoomStore();
    store.applyMessage({ type: 'sync', connections: [], homeZoneId: 'zone-a' });
    store.applyMessage({ type: 'room_updated', homeZoneId: 'zone-b' });

    expect(store.homeZoneId).toBe('zone-b');
  });

  it('room_updated is idempotent — same homeZoneId applied twice is fine', () => {
    const store = useRoomStore();
    store.applyMessage({ type: 'room_updated', homeZoneId: 'zone-a' });
    store.applyMessage({ type: 'room_updated', homeZoneId: 'zone-a' });

    expect(store.homeZoneId).toBe('zone-a');
  });
});
