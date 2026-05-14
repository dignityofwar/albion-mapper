import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ZoneNode from '../src/components/flow/ZoneNode.vue';
import { setActivePinia, createPinia } from 'pinia';
import { ref, nextTick } from 'vue';
import { useRoomStore } from '@/stores/useRoomStore';
import { deleteConnection, updateConnection } from '@/utils/roomOperations';

vi.mock('../src/utils/roomOperations', () => ({
  deleteConnection: vi.fn(),
  deleteNode: vi.fn(),
  updateConnection: vi.fn(),
  addConnection: vi.fn(),
}));

const BASE_PROPS = {
  type: 'zone',
  selected: false,
  dragging: false,
  resizing: false,
  connectable: true,
  zIndex: 0,
  position: { x: 0, y: 0 },
  dimensions: { width: 160, height: 100 },
  events: {} as any,
};

describe('Handle delete redirect', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('redirects toHandleId to center when a destination custom handle is deleted from a roadsHideout zone', async () => {
    const now = Date.now();
    const store = useRoomStore();
    store.setCredentials('room1', 'token1');

    // zone-source connects TO roads-hideout via custom handle 'custom-h1'
    store.applyMessage({
      type: 'sync',
      connections: [
        {
          id: 'conn-to-hideout',
          roomId: 'room1',
          fromZoneId: 'zone-source',
          toZoneId: 'roads-hideout',
          fromHandleId: 'e',
          toHandleId: 'custom-h1',
          expiresAt: new Date(now + 3600000).toISOString(),
          reportedAt: new Date().toISOString(),
        },
      ],
      homeZoneId: 'zone-source',
      nodePositions: [
        { zoneId: 'zone-source', x: 0, y: 0 },
        { zoneId: 'roads-hideout', x: 200, y: 0 },
      ],
      lastUpdatedAt: new Date().toISOString(),
      watching: 0,
      totalConnected: 0,
    });

    const wrapper = mount(ZoneNode as any, {
      props: {
        ...BASE_PROPS,
        id: 'roads-hideout',
        data: {
          type: 'roadsHideout',
          isHome: false,
          tier: 5,
          zoneName: 'Roads Hideout',
          customHandles: [
            { id: 'custom-h1', left: '0%', top: '50%' },
            { id: 'custom-h2', left: '100%', top: '50%' },
          ],
        },
      },
      global: {
        provide: {
          globalNow: ref(now),
          showToast: vi.fn(),
        },
        stubs: {
          Handle: true,
          TagTier: true,
          TagZone: true,
        },
      },
    });

    // Save handles with custom-h1 removed entirely
    await (wrapper.vm as any).saveCustomHandles([
      { id: 'custom-h2', left: '100%', top: '50%' },
    ]);

    // The connection must NOT be deleted
    expect(deleteConnection).not.toHaveBeenCalled();

    // The connection must be redirected to 'center'
    expect(updateConnection).toHaveBeenCalledWith(
      'room1',
      'token1',
      'conn-to-hideout',
      { toHandleId: 'center' }
    );
  });

  it('still deletes the connection when the source handle is removed (not destination)', async () => {
    const now = Date.now();
    const store = useRoomStore();
    store.setCredentials('room1', 'token1');

    // roads-hideout connects FROM custom handle 'custom-h1' to zone-dest
    store.applyMessage({
      type: 'sync',
      connections: [
        {
          id: 'conn-from-hideout',
          roomId: 'room1',
          fromZoneId: 'roads-hideout',
          toZoneId: 'zone-dest',
          fromHandleId: 'custom-h1',
          toHandleId: 'center',
          expiresAt: new Date(now + 3600000).toISOString(),
          reportedAt: new Date().toISOString(),
        },
      ],
      homeZoneId: 'zone-source',
      nodePositions: [
        { zoneId: 'zone-source', x: 0, y: 0 },
        { zoneId: 'roads-hideout', x: 100, y: 0 },
        { zoneId: 'zone-dest', x: 200, y: 0 },
      ],
      lastUpdatedAt: new Date().toISOString(),
      watching: 0,
      totalConnected: 0,
    });

    const wrapper = mount(ZoneNode as any, {
      props: {
        ...BASE_PROPS,
        id: 'roads-hideout',
        data: {
          type: 'roadsHideout',
          isHome: false,
          tier: 5,
          zoneName: 'Roads Hideout',
          customHandles: [
            { id: 'custom-h1', left: '0%', top: '50%' },
            { id: 'custom-h2', left: '100%', top: '50%' },
          ],
        },
      },
      global: {
        provide: {
          globalNow: ref(now),
          showToast: vi.fn(),
        },
        stubs: {
          Handle: true,
          TagTier: true,
          TagZone: true,
        },
      },
    });

    // Save handles with custom-h1 removed entirely
    await (wrapper.vm as any).saveCustomHandles([
      { id: 'custom-h2', left: '100%', top: '50%' },
    ]);

    // The connection must be deleted (source handle removed)
    expect(deleteConnection).toHaveBeenCalledWith('room1', 'token1', 'conn-from-hideout');
    expect(updateConnection).not.toHaveBeenCalled();

    await nextTick();
  });
});
