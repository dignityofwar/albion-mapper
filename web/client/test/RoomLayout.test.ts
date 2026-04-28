import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import RoomView from '../src/views/RoomView.vue';
import { useRoomStore } from '../src/stores/useRoomStore';
import { nextTick } from 'vue';

// Mock VueFlow
vi.mock('@vue-flow/core', () => ({
  useVueFlow: () => ({
    fitView: vi.fn(),
    updateNode: vi.fn(),
  }),
  VueFlow: { template: '<div></div>' },
  ConnectionMode: { Loose: 'loose' },
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

describe('RoomView node positioning', () => {
  it('should place new nodes to the RIGHT of the SOURCE node', async () => {
    setActivePinia(createPinia());
    const store = useRoomStore();

    // Setup initial state: Home node at (0,0)
    store.applyMessage({ 
        type: 'sync', 
        connections: [], 
        homeZoneId: 'home',
        nodePositions: [{ zoneId: 'home', x: 0, y: 0 }],
        lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: ['DebugTray', 'ReportForm', 'RoomSettings', 'VueFlow', 'Background', 'Controls']
      }
    });

    const vm = wrapper.vm as any;

    // Simulate connection added from 'home' (source) to 'new-node' (target)
    store.connections = [...store.connections, {
        id: 'c1',
        roomId: 'room1',
        fromZoneId: 'home',
        toZoneId: 'new-node',
        expiresAt: new Date().toISOString(),
        reportedAt: new Date().toISOString(),
    }];

    await nextTick();
    await nextTick();
    
    // Position of 'new-node' should be 'home'.x + 400 = 400
    const newNode = vm.flowNodes.find((n: any) => n.id === 'new-node');
    expect(newNode).toBeDefined();
    expect(newNode.position.x).toBe(400);
    expect(newNode.position.y).toBe(0);
    
    wrapper.unmount();
  });

  it('should place new nodes to the RIGHT of the SOURCE node when source is at X 400', async () => {
    setActivePinia(createPinia());
    const store = useRoomStore();

    // Setup initial state: Home node at (0,0), Source node at (400, 0)
    store.applyMessage({ 
        type: 'sync', 
        connections: [], 
        homeZoneId: 'home',
        nodePositions: [
            { zoneId: 'home', x: 0, y: 0 },
            { zoneId: 'source', x: 400, y: 0 }
        ],
        lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: ['DebugTray', 'ReportForm', 'RoomSettings', 'VueFlow', 'Background', 'Controls']
      }
    });

    const vm = wrapper.vm as any;

    // Simulate connection added from 'source' to 'new-node'
    store.connections = [...store.connections, {
        id: 'c2',
        roomId: 'room1',
        fromZoneId: 'source',
        toZoneId: 'new-node',
        expiresAt: new Date().toISOString(),
        reportedAt: new Date().toISOString(),
    }];

    await nextTick();
    await nextTick();
    
    // Position of 'new-node' should be 'source'.x + 400 = 800
    const newNode = vm.flowNodes.find((n: any) => n.id === 'new-node');
    expect(newNode).toBeDefined();
    expect(newNode.position.x).toBe(800);
    expect(newNode.position.y).toBe(0);
    
    wrapper.unmount();
  });

  it('should place new nodes to the LEFT of the SOURCE node when source is at X 500 but Home is at X 1000', async () => {
    setActivePinia(createPinia());
    const store = useRoomStore();

    // Setup initial state: Home node at (1000,0), Source node at (500, 0)
    store.applyMessage({
        type: 'sync',
        connections: [],
        homeZoneId: 'home',
        nodePositions: [
            { zoneId: 'home', x: 1000, y: 0 },
            { zoneId: 'source', x: 500, y: 0 }
        ],
        lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: ['DebugTray', 'ReportForm', 'RoomSettings', 'VueFlow', 'Background', 'Controls']
      }
    });

    const vm = wrapper.vm as any;

    // Simulate connection added from 'source' (500) to 'new-node' (target)
    store.connections = [...store.connections, {
        id: 'c3',
        roomId: 'room1',
        fromZoneId: 'source',
        toZoneId: 'new-node',
        expiresAt: new Date().toISOString(),
        reportedAt: new Date().toISOString(),
    }];

    await nextTick();
    await nextTick();

    // Position of 'new-node' should be 'source'.x - 400 = 100
    // Because parentPos.x (500) < homePos.x (1000)
    const newNode = vm.flowNodes.find((n: any) => n.id === 'new-node');
    expect(newNode).toBeDefined();
    expect(newNode.position.x).toBe(100);
    expect(newNode.position.y).toBe(0);

    wrapper.unmount();
  });
});
