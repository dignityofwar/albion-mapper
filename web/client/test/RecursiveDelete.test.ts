import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import RoomView from '../src/views/RoomView.vue';
import { useRoomStore } from '../src/stores/useRoomStore';
import { nextTick } from 'vue';
import * as roomOps from '../src/utils/roomOperations';

// Mock VueFlow and router
vi.mock('@vue-flow/core', () => ({
  useVueFlow: () => ({
    fitView: vi.fn(),
    updateNode: vi.fn(),
  }),
  VueFlow: { template: '<div><slot /></div>' },
  ConnectionMode: { Loose: 'loose' },
  BaseEdge: { template: '<div></div>' },
  EdgeLabelRenderer: { template: '<div><slot /></div>' },
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

// Mock roomOperations
vi.mock('../src/utils/roomOperations', () => ({
  deleteConnection: vi.fn(),
  updateConnection: vi.fn(),
}));

describe('Recursive Delete', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('correctly identifies connections with children and performs recursive delete', async () => {
    sessionStorage.setItem('token:room1', 'some-token');
    const store = useRoomStore();
    store.setCredentials('room1', 'some-token');

    // Setup A -> B -> C
    const conn1 = {
      id: 'c1',
      roomId: 'room1',
      fromZoneId: 'zone-a',
      toZoneId: 'zone-b',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      reportedAt: new Date().toISOString(),
    };
    const conn2 = {
      id: 'c2',
      roomId: 'room1',
      fromZoneId: 'zone-b',
      toZoneId: 'zone-c',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      reportedAt: new Date().toISOString(),
    };

    store.applyMessage({
      type: 'sync',
      connections: [conn1, conn2],
      homeZoneId: 'zone-a',
      nodePositions: [
        { zoneId: 'zone-a', x: 0, y: 0 },
        { zoneId: 'zone-b', x: 100, y: 0 },
        { zoneId: 'zone-c', x: 200, y: 0 },
      ],
      lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: ['DebugTray', 'ReportForm', 'RoomSettings', 'Background', 'Controls']
      }
    });

    await nextTick();
    await nextTick();

    const vm = wrapper.vm as any;
    const edges = vm.flowEdges;

    expect(edges).toHaveLength(2);

    const edge1 = edges.find((e: any) => e.id === 'c1');
    const edge2 = edges.find((e: any) => e.id === 'c2');

    // Verify hasChildren
    expect(edge1.data.hasChildren).toBe(true);
    expect(edge2.data.hasChildren).toBe(false);

    // Trigger recursive delete on edge1
    await edge1.data.onDeleteRecursive('c1');

    // Verify deleteConnection was called for both, and in correct order (c2 then c1)
    expect(roomOps.deleteConnection).toHaveBeenCalledTimes(2);
    expect(roomOps.deleteConnection).toHaveBeenNthCalledWith(1, 'room1', 'some-token', 'c2');
    expect(roomOps.deleteConnection).toHaveBeenNthCalledWith(2, 'room1', 'some-token', 'c1');

    wrapper.unmount();
  });
});
