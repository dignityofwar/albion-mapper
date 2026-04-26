import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import RoomView from '../src/views/RoomView.vue';
import { useRoomStore } from '../src/stores/useRoomStore.js';
import { nextTick } from 'vue';

// Mock VueFlow and router to avoid complex setup
vi.mock('@vue-flow/core', () => ({
  useVueFlow: () => ({
    fitView: vi.fn(),
  }),
  VueFlow: { template: '<div></div>' },
  ConnectionMode: { Loose: 'loose' },
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

beforeEach(() => {
  setActivePinia(createPinia());
  sessionStorage.clear();
});

describe('RoomView', () => {
  it('updates flowEdges when a connection is added to the store', async () => {
    sessionStorage.setItem('token:room1', 'some-token');
    
    const store = useRoomStore();
    store.setCredentials('room1', 'some-token');
    
    // Initial state: room exists with home node
    store.applyMessage({ 
        type: 'sync', 
        connections: [], 
        homeZoneId: 'zone-a' 
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: ['DebugTray', 'ReportForm', 'RoomSettings', 'VueFlow', 'Background', 'Controls']
      }
    });

    // Verify initial state: 0 edges
    const vm = wrapper.vm as any;
    expect(vm.flowEdges).toHaveLength(0);

    // Simulate adding a connection
    store.applyMessage({ 
      type: 'connection_added', 
      connection: {
        id: 'c1',
        roomId: 'room1',
        fromZoneId: 'zone-a',
        toZoneId: 'zone-b',
        expiresAt: new Date().toISOString(),
        reportedAt: new Date().toISOString(),
      }
    });

    // Wait for the watcher to run
    await nextTick();
    await nextTick(); // watchers might need a couple ticks

    expect(vm.flowEdges).toHaveLength(1);
    expect(vm.flowEdges[0].id).toBe('c1');
    
    wrapper.unmount();
  });

  it('calls updateNodePositionsInStore when a node is dragged', async () => {
    sessionStorage.setItem('token:room1', 'some-token');
    
    const store = useRoomStore();
    store.setCredentials('room1', 'some-token');
    
    // Spy on updateNodePositionsInStore
    const spy = vi.spyOn(store, 'updateNodePositionsInStore');
    
    store.applyMessage({ 
        type: 'sync', 
        connections: [], 
        homeZoneId: 'zone-a',
        nodePositions: [
            { zoneId: 'zone-a', x: 0, y: 0 },
            { zoneId: 'zone-b', x: 100, y: 100 }
        ]
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: ['DebugTray', 'ReportForm', 'RoomSettings', 'VueFlow', 'Background', 'Controls']
      }
    });

    const vm = wrapper.vm as any;
    
    // Simulate node move
    vm.flowNodes.value = [
        { id: 'zone-a', position: { x: 0, y: 0 } },
        { id: 'zone-b', position: { x: 10, y: 10 } }
    ];
    
    // Call onNodeDragStop
    vm.onNodeDragStop();

    expect(spy).toHaveBeenCalled();
    expect(store.nodePositions).toEqual([
        { zoneId: 'zone-a', x: 0, y: 0 },
        { zoneId: 'zone-b', x: 10, y: 10 }
    ]);
    
    wrapper.unmount();
  });

  it('sets draggable correctly for multiple nodes', async () => {
    const store = useRoomStore();
    
    store.applyMessage({ 
        type: 'sync', 
        connections: [], 
        homeZoneId: 'zone-a',
        nodePositions: [
            { zoneId: 'zone-a', x: 0, y: 0 },
            { zoneId: 'zone-b', x: 10, y: 10 }
        ]
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: ['DebugTray', 'ReportForm', 'RoomSettings', 'VueFlow', 'Background', 'Controls']
      }
    });

    const vm = wrapper.vm as any;
    
    // Check nodes
    expect(vm.flowNodes).toHaveLength(2);
    const homeNode = vm.flowNodes.find((n: any) => n.id === 'zone-a');
    const otherNode = vm.flowNodes.find((n: any) => n.id === 'zone-b');

    expect(homeNode.draggable).toBe(false);
    expect(otherNode.draggable).toBe(true);
    
    wrapper.unmount();
  });
});
