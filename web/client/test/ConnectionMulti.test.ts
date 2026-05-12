import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import RoomView from '../src/views/RoomView.vue';
import { useRoomStore } from '@/stores/useRoomStore';
import { nextTick } from 'vue';

// Mock Vue Flow
vi.mock('@vue-flow/core', () => ({
  VueFlow: { 
    template: '<div><slot /><slot name="connection-line" v-bind="{ sourceNode: { id: \'\' }, sourceHandle: { id: \'\' } }" /></div>' 
  },
  useVueFlow: () => ({
    onConnect: vi.fn(),
    onConnectStart: vi.fn(),
    onConnectEnd: vi.fn(),
    onNodeDragStart: vi.fn(),
    onNodeDragStop: vi.fn(),
    onMoveStart: vi.fn(),
    onMoveEnd: vi.fn(),
    project: (pos: any) => pos,
    toObject: () => ({ nodes: [], edges: [] }),
    updateNode: vi.fn(),
    getNode: { value: vi.fn().mockReturnValue({ id: 'test' }) },
  }),
  ConnectionMode: { Loose: 'loose' },
  Position: {
    Top: 'top',
    Right: 'right',
    Bottom: 'bottom',
    Left: 'left',
  }
}));

// Mock router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
  useRoute: () => ({
    params: { id: 'test-room' },
  }),
}));

describe('RoomView - Multiple Connections', () => {
  let pinia: any;
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    const store = useRoomStore();
    store.setCredentials('test-room', 'test-token');
    
    // Mock fetch for room initialization
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        connections: [],
        nodePositions: [],
        homeZoneId: 'qiient-in-odetum',
        roomTitle: 'Test Room'
      }),
    } as any);
  });

  it('shows an error toast when trying to create a second connection between a roads and a non-roads zone', async () => {
    const store = useRoomStore();
    // xerites-oxoulum is roads, adrens-hill is royal (non-roads)
    store.connections = [
      {
        id: 'conn1',
        roomId: 'test-room',
        fromZoneId: 'adrens-hill',
        toZoneId: 'xerites-oxoulum',
        fromHandleId: 'w',
        toHandleId: 'x-p6',
        expiresAt: new Date(Date.now() + 1000000).toISOString(),
        reportedAt: new Date().toISOString(),
      }
    ];

    const wrapper = mount(RoomView, {
      props: { id: 'test-room' },
      global: {
        plugins: [pinia],
        stubs: {
          ZoneNode: true,
          NonRoadsNode: true,
          ConnectionEdge: true,
          ConnectionLine: true,
          ReportForm: true,
          DebugTray: true,
          MegaToast: true,
          TopToolbar: true,
          TopLeftToolbar: true,
          TopRightToolbar: true,
          BottomRightPins: true,
          MobileRoomSummary: true,
          Background: true,
          Controls: true,
        }
      }
    });

    const vm = wrapper.vm as any;
    
    // Attempt to connect them again with different handles
    await vm.handleConnect({
      source: 'adrens-hill',
      sourceHandle: 's',
      target: 'xerites-oxoulum',
      targetHandle: 'x-p1'
    });

    expect(vm.toast).toBe("A non-roads zone cannot have multiple portal entrances to a roads zone.");
    expect(vm.toastType).toBe("error");
  });

  it('shows a confirmation modal when trying to create a second connection between two roads zones', async () => {
    const store = useRoomStore();
    // Both are roads
    store.connections = [
      {
        id: 'conn1',
        roomId: 'test-room',
        fromZoneId: 'xerites-oxoulum',
        toZoneId: 'puyitos-aiataum',
        fromHandleId: 'x-p4',
        toHandleId: 'p-p6',
        expiresAt: new Date(Date.now() + 1000000).toISOString(),
        reportedAt: new Date().toISOString(),
      }
    ];

    const wrapper = mount(RoomView, {
      props: { id: 'test-room' },
      global: {
        plugins: [pinia],
        stubs: {
          ZoneNode: true,
          NonRoadsNode: true,
          ConnectionEdge: true,
          ConnectionLine: true,
          ReportForm: true,
          DebugTray: true,
          MegaToast: true,
          TopToolbar: true,
          TopLeftToolbar: true,
          TopRightToolbar: true,
          BottomRightPins: true,
          MobileRoomSummary: true,
          Background: true,
          Controls: true,
        }
      }
    });

    const vm = wrapper.vm as any;
    
    // Attempt to connect them again with different handles
    await vm.handleConnect({
      source: 'xerites-oxoulum',
      sourceHandle: 'x-p5',
      target: 'puyitos-aiataum',
      targetHandle: 'p-p1'
    });

    // Expect confirmation modal to be visible
    expect(vm.showConfirmationModal).toBe(true);
    expect(vm.confirmationModalText).toContain("This will create an unusual and rare connection");

    // Mock reportForm.setConnection
    vm.reportForm = {
      setConnection: vi.fn(),
      open: vi.fn(),
    };

    // Confirm
    await vm.handleConfirmConnection();

    expect(vm.reportForm.setConnection).toHaveBeenCalledWith(
      'xerites-oxoulum',
      'x-p5',
      'puyitos-aiataum',
      'p-p1',
      true // isLoop
    );
  });
});
