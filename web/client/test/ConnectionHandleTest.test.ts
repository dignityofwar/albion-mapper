import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import RoomView from '../src/views/RoomView.vue';
import { useRoomStore } from '../src/stores/useRoomStore';
import { setActivePinia, createPinia } from 'pinia';
import { ref } from 'vue';

vi.mock('vue-router', () => ({
    useRouter: () => ({
        replace: vi.fn(),
        push: vi.fn()
    })
}));

vi.mock('@vue-flow/core', async () => {
    const actual = await vi.importActual('@vue-flow/core');
    return {
        ...actual as any,
        useVueFlow: () => ({
            getNode: (id: string) => ({ position: { x: 0, y: 0 } }),
            fitView: vi.fn(),
            updateNode: vi.fn(),
            setCenter: vi.fn(),
            updateNodeInternals: vi.fn(),
            screenToFlowCoordinate: vi.fn(),
            onMoveStart: vi.fn(),
            onMoveEnd: vi.fn(),
            onNodeDragStart: vi.fn(),
        })
    };
});

describe('RoomView Connection Handle', () => {
  it('should set center handle to bottom on connect', async () => {
    setActivePinia(createPinia());
    const store = useRoomStore();
    store.setCredentials('room1', 'some-token');
    sessionStorage.setItem('token:room1', 'some-token');
    
    // Initialize node positions
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
    
    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: {
          VueFlow: true,
          Background: true,
          Controls: true,
          ReportForm: {
            template: '<div id="report-form-stub"></div>',
            setup(props, { expose }) {
              const store = useRoomStore();
              const setConnection = vi.fn((fromZoneId, fromHandleId, toZoneId, toHandleId) => {
                store.connections.push({
                  id: 'new-conn',
                  roomId: 'room1',
                  fromZoneId,
                  fromHandleId,
                  toZoneId,
                  toHandleId,
                  expiresAt: new Date().toISOString(),
                  reportedAt: new Date().toISOString()
                } as any);
              });
              const focusTimeInput = vi.fn();
              expose({ setConnection, focusTimeInput });
              return { setConnection, focusTimeInput };
            }
          },
          DebugTray: true,
          RoomSettings: true,
        },
        provide: {
          'globalNow': ref(Date.now()),
        }
      }
    });
    
    const vm = wrapper.vm as any;
    
    // Spy on store.updateNodeCustomHandles
    const spy = vi.spyOn(store, 'updateNodeCustomHandles');
    
    // Simulate handleConnect
    await vm.handleConnect({
      source: 'zone-a',
      sourceHandle: 'n',
      target: 'zone-b',
      targetHandle: 'center'
    });
    
    expect(spy).toHaveBeenCalled();
    
    const args = spy.mock.calls[0];
    const newCustomHandles = args[1];
    const centerHandle = newCustomHandles.find((h: any) => h.id === 'center');
    
    expect(centerHandle?.position).toBe('bottom');
    
    wrapper.unmount();
  });

  it('should have "center" as targetHandleId in connection', async () => {
    setActivePinia(createPinia());
    const store = useRoomStore();
    store.setCredentials('room1', 'some-token');
    sessionStorage.setItem('token:room1', 'some-token');
    
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
    
    const wrapper = mount(RoomView, {
      props: { id: 'room1' },
      global: {
        stubs: {
          VueFlow: true,
          Background: true,
          Controls: true,
          ReportForm: {
            template: '<div id="report-form-stub"></div>',
            setup(props, { expose }) {
              const store = useRoomStore();
              const setConnection = vi.fn((fromZoneId, fromHandleId, toZoneId, toHandleId) => {
                store.connections.push({
                  id: 'new-conn',
                  roomId: 'room1',
                  fromZoneId,
                  fromHandleId,
                  toZoneId,
                  toHandleId,
                  expiresAt: new Date().toISOString(),
                  reportedAt: new Date().toISOString()
                } as any);
              });
              const focusTimeInput = vi.fn();
              expose({ setConnection, focusTimeInput });
              return { setConnection, focusTimeInput };
            }
          },
          DebugTray: true,
          RoomSettings: true,
        },
        provide: {
          'globalNow': ref(Date.now()),
        }
      }
    });
    
    const vm = wrapper.vm as any;
    
    // Simulate handleConnect
    await vm.handleConnect({
      source: 'zone-a',
      sourceHandle: 'n',
      target: 'zone-b',
      targetHandle: 'center'
    });
    
    // We expect the connection to have targetHandleId: 'center'
    // Since we are mocking store, we can check store.connections
    const connection = store.connections[0];
    expect(connection.toHandleId).toBe('center');
    
    wrapper.unmount();
  });

});
