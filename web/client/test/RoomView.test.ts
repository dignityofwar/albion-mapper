import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import RoomView from '../src/views/RoomView.vue';
import { useRoomStore } from '../src/stores/useRoomStore';
import { nextTick } from 'vue';

// Mock VueFlow and router to avoid complex setup
vi.mock('@vue-flow/core', () => ({
  useVueFlow: () => ({
    fitView: vi.fn(),
    updateNode: vi.fn(),
    screenToFlowCoordinate: vi.fn((pos) => pos),
  }),
  VueFlow: { template: '<div></div>' },
  ConnectionMode: { Loose: 'loose' },
  Position: { Top: 'top', Right: 'right', Bottom: 'bottom', Left: 'left' },
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: vi.fn(() => Promise.resolve()),
    push: vi.fn(() => Promise.resolve()),
  }),
}));

vi.mock('../src/utils/roomOperations.js', () => ({
  updateConnection: vi.fn(),
  deleteConnection: vi.fn(),
  addConnection: vi.fn(),
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
        homeZoneId: 'zone-a',
        nodePositions: [],
        lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: {
          ReportForm: {
            template: '<div id="report-form-stub"></div>',
            setup(props, { expose }) {
              const setFromZoneId = vi.fn();
              const setConnection = vi.fn();
              expose({ setFromZoneId, setConnection });
              return { setFromZoneId, setConnection };
            }
          },
          DebugTray: true,
          RoomSettings: true,
          VueFlow: true,
          Background: true,
          Controls: true
        }
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
    
    console.log('connections:', store.connections);
    console.log('flowEdges:', vm.flowEdges);

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
        ],
        lastUpdatedAt: new Date().toISOString()
    });

    await nextTick();

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: {
          ReportForm: {
            template: '<div id="report-form-stub"></div>',
            setup(props, { expose }) {
              const setFromZoneId = vi.fn();
              const setConnection = vi.fn();
              expose({ setFromZoneId, setConnection });
              return { setFromZoneId, setConnection };
            }
          },
          DebugTray: true,
          RoomSettings: true,
          VueFlow: true,
          Background: true,
          Controls: true
        }
      }
    });

    await nextTick();
    await nextTick();

    const vm = wrapper.vm as any;
    
    // Simulate node move
    // We update the position of the existing node in flowNodes
    const nodeB = vm.flowNodes.find((n: any) => n.id === 'zone-b');
    nodeB.position = { x: 10, y: 10 };
    
    // Call onNodeDragStop
    vm.onNodeDragStop();

    expect(spy).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ zoneId: 'zone-a', x: 0, y: 0 }),
        expect.objectContaining({ zoneId: 'zone-b', x: 10, y: 10 })
    ]));
    
    wrapper.unmount();
  });

  it('preserves customHandles and features when a node is dragged', async () => {
    sessionStorage.setItem('token:room1', 'some-token');
    
    const store = useRoomStore();
    store.setCredentials('room1', 'some-token');
    const spy = vi.spyOn(store, 'updateNodePositionsInStore');
    
    const customHandles = [{ id: 'h1', left: '10%', top: '20%' }];
    const features = { chest: true };

    store.applyMessage({
        type: 'sync',
        connections: [],
        homeZoneId: 'zone-a',
        nodePositions: [
            { zoneId: 'zone-a', x: 0, y: 0 },
            { zoneId: 'zone-b', x: 100, y: 100, customHandles, features }
        ],
        lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: {
          ReportForm: {
            template: '<div id="report-form-stub"></div>',
            setup(props, { expose }) {
              const setFromZoneId = vi.fn();
              const setConnection = vi.fn();
              expose({ setFromZoneId, setConnection });
              return { setFromZoneId, setConnection };
            }
          },
          DebugTray: true,
          RoomSettings: true,
          VueFlow: true,
          Background: true,
          Controls: true
        }
      }
    });

    await nextTick();
    await nextTick();

    const vm = wrapper.vm as any;
    const nodeB = vm.flowNodes.find((n: any) => n.id === 'zone-b');
    nodeB.position = { x: 50, y: 50 };
    
    vm.onNodeDragStop();

    expect(spy).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ 
          zoneId: 'zone-b', 
          x: 50, 
          y: 50, 
          customHandles,
          features
        })
    ]));
    
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
        ],
        lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: {
          ReportForm: {
            template: '<div id="report-form-stub"></div>',
            setup(props, { expose }) {
              const setFromZoneId = vi.fn();
              const setConnection = vi.fn();
              expose({ setFromZoneId, setConnection });
              return { setFromZoneId, setConnection };
            }
          },
          DebugTray: true,
          RoomSettings: true,
          VueFlow: true,
          Background: true,
          Controls: true
        }
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

  it('does not flash on initial load', async () => {
    sessionStorage.setItem('token:room1', 'some-token');
    
    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: {
          ReportForm: {
            template: '<div id="report-form-stub"></div>',
            setup(props, { expose }) {
              const setFromZoneId = vi.fn();
              const setConnection = vi.fn();
              expose({ setFromZoneId, setConnection });
              return { setFromZoneId, setConnection };
            }
          },
          DebugTray: true,
          RoomSettings: true,
          VueFlow: true,
          Background: true,
          Controls: true
        }
      }
    });

    const vm = wrapper.vm as any;
    const store = useRoomStore();

    // Trigger initial sync
    store.applyMessage({ 
        type: 'sync', 
        connections: [], 
        homeZoneId: 'zone-a',
        nodePositions: [],
        lastUpdatedAt: new Date().toISOString()
    });

    // Wait for the watcher to potentially run
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(vm.lastUpdateFlash).toBe(false);
    
    wrapper.unmount();
  });

  it('flashes on subsequent updates', async () => {
    sessionStorage.setItem('token:room1', 'some-token');
    
    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: {
          ReportForm: {
            template: '<div id="report-form-stub"></div>',
            setup(props, { expose }) {
              const setFromZoneId = vi.fn();
              const setConnection = vi.fn();
              expose({ setFromZoneId, setConnection });
              return { setFromZoneId, setConnection };
            }
          },
          DebugTray: true,
          RoomSettings: true,
          VueFlow: true,
          Background: true,
          Controls: true
        }
      }
    });

    const vm = wrapper.vm as any;
    const store = useRoomStore();

    // 1. Initial sync
    store.applyMessage({ 
        type: 'sync', 
        connections: [], 
        homeZoneId: 'zone-a',
        nodePositions: [],
        lastUpdatedAt: new Date().toISOString()
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(vm.lastUpdateFlash).toBe(false);

    // 2. Subsequent update (should skip because it is the 2nd update)
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
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(vm.lastUpdateFlash).toBe(false);

    // 3. Third update (should flash)
    store.applyMessage({ 
      type: 'connection_added', 
      connection: {
        id: 'c2',
        roomId: 'room1',
        fromZoneId: 'zone-a',
        toZoneId: 'zone-c',
        expiresAt: new Date().toISOString(),
        reportedAt: new Date().toISOString(),
      }
    });

    // Wait for the watcher to run
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(vm.lastUpdateFlash).toBe(true);
    
    wrapper.unmount();
  });

  it('ensures all nodes in connections are present in flowNodes', async () => {
    sessionStorage.setItem('token:room1', 'some-token');
    
    const store = useRoomStore();
    store.setCredentials('room1', 'some-token');
    
    // Initial state: room exists with home node, and an existing connection (zone-a to zone-b)
    store.applyMessage({ 
        type: 'sync', 
        connections: [{
            id: 'c1',
            roomId: 'room1',
            fromZoneId: 'zone-a',
            toZoneId: 'zone-b',
            expiresAt: new Date().toISOString(),
            reportedAt: new Date().toISOString(),
        }], 
        homeZoneId: 'zone-a',
        nodePositions: [],
        lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: {
          ReportForm: {
            template: '<div id="report-form-stub"></div>',
            setup(props, { expose }) {
              const setFromZoneId = vi.fn();
              const setConnection = vi.fn();
              expose({ setFromZoneId, setConnection });
              return { setFromZoneId, setConnection };
            }
          },
          DebugTray: true,
          RoomSettings: true,
          VueFlow: true,
          Background: true,
          Controls: true
        }
      }
    });

    // Simulate adding a connection between zone-c and zone-d (not connected to zone-a)
    store.applyMessage({ 
      type: 'connection_added', 
      connection: {
        id: 'c2',
        roomId: 'room1',
        fromZoneId: 'zone-c',
        toZoneId: 'zone-d',
        expiresAt: new Date().toISOString(),
        reportedAt: new Date().toISOString(),
      }
    });

    // Wait for the watcher to run
    await nextTick();
    await nextTick();
    
    const vm = wrapper.vm as any;
    // Verify nodes exist
    expect(vm.flowNodes.find((n: any) => n.id === 'zone-c')).toBeDefined();
    expect(vm.flowNodes.find((n: any) => n.id === 'zone-d')).toBeDefined();
    expect(vm.flowEdges).toHaveLength(2);
    
    wrapper.unmount();
  });

  it('updates an existing connection directly when dragging from handle to handle', async () => {
    const { updateConnection } = await import('../src/utils/roomOperations.js');
    sessionStorage.setItem('token:room1', 'some-token');
    
    const store = useRoomStore();
    store.setCredentials('room1', 'some-token');
    
    const expiry = new Date(Date.now() + 3600000).toISOString();
    store.applyMessage({ 
        type: 'sync', 
        connections: [{
          id: 'c1',
          roomId: 'room1',
          fromZoneId: 'zone-a',
          toZoneId: 'zone-b',
          expiresAt: expiry,
          reportedAt: new Date().toISOString()
        }], 
        homeZoneId: 'zone-a',
        nodePositions: [],
        lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: {
          ReportForm: {
            template: '<div id="report-form-stub"></div>',
            setup(props, { expose }) {
              const setFromZoneId = vi.fn();
              const setConnection = vi.fn();
              expose({ setFromZoneId, setConnection });
              return { setFromZoneId, setConnection };
            }
          },
          DebugTray: true,
          RoomSettings: true,
          VueFlow: true,
          Background: true,
          Controls: true
        }
      }
    });

    const vm = wrapper.vm as any;
    
    // Simulate handle-to-handle connection between existing zones
    vm.handleConnect({
      source: 'zone-a',
      sourceHandle: 'top',
      target: 'zone-b',
      targetHandle: 'bottom'
    });

    expect(updateConnection).toHaveBeenCalledWith(
      'room1',
      'some-token',
      'c1',
      { fromHandleId: 'top', toHandleId: 'bottom' }
    );
    
    wrapper.unmount();
  });

  it('updates an existing connection directly even if dragged in reverse direction', async () => {
    const { updateConnection } = await import('../src/utils/roomOperations.js');
    sessionStorage.setItem('token:room1', 'some-token');
    
    const store = useRoomStore();
    store.setCredentials('room1', 'some-token');
    
    const expiry = new Date(Date.now() + 3600000).toISOString();
    store.applyMessage({ 
        type: 'sync', 
        connections: [{
          id: 'c1',
          roomId: 'room1',
          fromZoneId: 'zone-a',
          toZoneId: 'zone-b',
          expiresAt: expiry,
          reportedAt: new Date().toISOString()
        }], 
        homeZoneId: 'zone-a',
        nodePositions: [],
        lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: {
          ReportForm: {
            template: '<div id="report-form-stub"></div>',
            setup(props, { expose }) {
              const setFromZoneId = vi.fn();
              const setConnection = vi.fn();
              expose({ setFromZoneId, setConnection });
              return { setFromZoneId, setConnection };
            }
          },
          DebugTray: true,
          RoomSettings: true,
          VueFlow: true,
          Background: true,
          Controls: true
        }
      }
    });

    const vm = wrapper.vm as any;
    
    // Simulate handle-to-handle connection but source/target are reversed compared to DB
    vm.handleConnect({
      source: 'zone-b',
      sourceHandle: 'bottom',
      target: 'zone-a',
      targetHandle: 'top'
    });

    // It should know that 'zone-b' is the 'to' side and 'zone-a' is the 'from' side
    expect(updateConnection).toHaveBeenCalledWith(
      'room1',
      'some-token',
      'c1',
      { fromHandleId: 'top', toHandleId: 'bottom' }
    );
    
    wrapper.unmount();
  });

  it('does NOT create a ghost node when dragging from a node (no handle)', async () => {
    sessionStorage.setItem('token:room1', 'some-token');
    const store = useRoomStore();
    store.setCredentials('room1', 'some-token');
    
    store.applyMessage({ 
        type: 'sync', 
        connections: [], 
        homeZoneId: 'zone-a',
        nodePositions: [{ zoneId: 'zone-a', x: 0, y: 0 }],
        lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: {
          ReportForm: {
            template: '<div id="report-form-stub"></div>',
            setup(props, { expose }) {
              const setFromZoneId = vi.fn();
              const setConnection = vi.fn();
              expose({ setFromZoneId, setConnection });
              return { setFromZoneId, setConnection };
            }
          },
          DebugTray: true,
          RoomSettings: true,
          VueFlow: true,
          Background: true,
          Controls: true
        }
      }
    });

    const vm = wrapper.vm as any;
    
    // Simulate connection start from node, but NO handleId
    vm.handleConnectStart({ nodeId: 'zone-a', handleId: null });
    
    // Simulate connection end in empty space
    vm.handleConnectEnd({ clientX: 100, clientY: 100 } as MouseEvent);
    
    // Check that ghostNode is still null
    expect(vm.ghostNode).toBeNull();
    
    wrapper.unmount();
  });
});

describe('RoomView Home Zone Protection', () => {
  it('should NOT have handleSetHomeZone and should NOT allow changing home zone on click', async () => {
    sessionStorage.setItem('token:room1', 'some-token');
    const store = useRoomStore();
    store.setCredentials('room1', 'some-token');
    
    store.applyMessage({ 
        type: 'sync', 
        connections: [], 
        homeZoneId: 'home-zone',
        nodePositions: [
            { zoneId: 'home-zone', x: 0, y: 0 },
            { zoneId: 'other-zone', x: 100, y: 100 }
        ],
        lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: ['DebugTray', 'ReportForm', 'RoomSettings', 'Background', 'Controls']
      }
    });

    const vm = wrapper.vm as any;
    
    // Check that handleSetHomeZone is NOT present
    expect(vm.handleSetHomeZone).toBeUndefined();
    
    wrapper.unmount();
  });

  it('updates ghost node type and position when target zone changes', async () => {
    sessionStorage.setItem('token:room1', 'some-token');
    const store = useRoomStore();
    store.setCredentials('room1', 'some-token');
    
    store.applyMessage({ 
        type: 'sync', 
        connections: [], 
        homeZoneId: 'zone-a',
        nodePositions: [{ zoneId: 'zone-a', x: 0, y: 0 }],
        lastUpdatedAt: new Date().toISOString()
    });

    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: {
          ReportForm: {
            template: '<div id="report-form-stub"></div>',
            setup(props, { expose }) {
              const setFromZoneId = vi.fn();
              const setConnection = vi.fn();
              expose({ setFromZoneId, setConnection });
              return { setFromZoneId, setConnection };
            }
          },
          DebugTray: true,
          RoomSettings: true,
          VueFlow: true,
          Background: true,
          Controls: true
        }
      }
    });

    const vm = wrapper.vm as any;
    
    // 1. Create a ghost node (starts as 'zone' 400x400)
    vm.handleConnectStart({ nodeId: 'zone-a', handleId: 'right' });
    vm.handleConnectEnd({ clientX: 200, clientY: 200 } as MouseEvent);
    
    expect(vm.ghostNode).not.toBeNull();
    expect(vm.ghostNode.type).toBe('zone');
    const initialPos = { ...vm.ghostNode.position };
    
    // 2. Simulate change to a non-roads zone (e.g. 'lymhurst')
    vm.handleToZoneChange('lymhurst');
    
    expect(vm.ghostNode.type).toBe('non-roads');
    expect(vm.ghostNode.position.x).toBe(initialPos.x + 100);
    expect(vm.ghostNode.position.y).toBe(initialPos.y + 100);
    
    // 3. Change back to a roads zone
    vm.handleToZoneChange('qiient-nutis'); // This is a roads hideout
    expect(vm.ghostNode.type).toBe('zone');
    expect(vm.ghostNode.position.x).toBe(initialPos.x);
    expect(vm.ghostNode.position.y).toBe(initialPos.y);
    
    wrapper.unmount();
  });
});
