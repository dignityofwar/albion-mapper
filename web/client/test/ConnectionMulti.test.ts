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

  it('does NOT show confirmation modal when replacing a center handle with a real handle between two roads zones', async () => {
    const store = useRoomStore();
    // Both are roads; existing connection uses center on the target side (e.g. after adding a shaped zone)
    store.connections = [
      {
        id: 'conn1',
        roomId: 'test-room',
        fromZoneId: 'xerites-oxoulum',
        toZoneId: 'puyitos-aiataum',
        fromHandleId: 'x-p4',
        toHandleId: 'center', // hideout/shapeless zone assigned center
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

    // Attempt to connect with a real handle on the target (replacing center)
    await vm.handleConnect({
      source: 'xerites-oxoulum',
      sourceHandle: 'x-p4',
      target: 'puyitos-aiataum',
      targetHandle: 'p-p3'
    });

    // Should NOT show the confirmation modal — this is a handle replacement
    expect(vm.showConfirmationModal).toBe(false);
  });

  it('does NOT show confirmation modal when replacing a null/undefined handle (treated as center) between two roads zones', async () => {
    const store = useRoomStore();
    // Both are roads; existing connection has no fromHandleId (defaults to center)
    store.connections = [
      {
        id: 'conn1',
        roomId: 'test-room',
        fromZoneId: 'xerites-oxoulum',
        toZoneId: 'puyitos-aiataum',
        fromHandleId: undefined as any,
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

    // Attempt to connect with a real handle on the source (replacing the implicit center)
    await vm.handleConnect({
      source: 'xerites-oxoulum',
      sourceHandle: 'x-p2',
      target: 'puyitos-aiataum',
      targetHandle: 'p-p6'
    });

    // Should NOT show the confirmation modal — this is a handle replacement
    expect(vm.showConfirmationModal).toBe(false);
  });

  it('does NOT show confirmation modal when dragging one end of an existing connection to a new handle (both roads, real handles)', async () => {
    const store = useRoomStore();
    // firos-ezatam -> settun-al-odetum scenario: both roads, both have real handles
    // User drags from f-p6 (same source handle) to a different target handle (s instead of w)
    store.connections = [
      {
        id: 'conn1',
        roomId: 'test-room',
        fromZoneId: 'firos-ezatam',
        toZoneId: 'settun-al-odetum',
        fromHandleId: 'f-p6',
        toHandleId: 'w',
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

    // Drag from the same source handle (f-p6) to a different target handle (s instead of w)
    await vm.handleConnect({
      source: 'firos-ezatam',
      sourceHandle: 'f-p6',
      target: 'settun-al-odetum',
      targetHandle: 's'
    });

    // Should NOT show the confirmation modal — same source handle, just moving the target end
    expect(vm.showConfirmationModal).toBe(false);
  });
});
