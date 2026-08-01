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

  it('opens the Add Connection form with a warning when trying to create a second connection between two roads zones', async () => {
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

    // Mock reportForm.setConnection before the connect call
    const setConnectionMock = vi.fn();
    vm.reportForm = {
      setConnection: setConnectionMock,
      open: vi.fn(),
    };

    // Attempt to connect them again with different handles
    await vm.handleConnect({
      source: 'xerites-oxoulum',
      sourceHandle: 'x-p5',
      target: 'puyitos-aiataum',
      targetHandle: 'p-p1'
    });

    // Should NOT show a confirmation modal — warning is inline in the Add Connection form
    expect(vm.showConfirmationModal).toBe(false);

    // Should open the Add Connection form with the multiple portal link warning
    expect(setConnectionMock).toHaveBeenCalledWith(
      'xerites-oxoulum',
      'x-p5',
      'puyitos-aiataum',
      'p-p1',
      expect.stringContaining('multiple portal link')
    );
    expect(setConnectionMock.mock.calls[0][4]).toContain('extremely');
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

  it('opens the Add Connection form with a warning when a roads zone tries to connect to the same non-roads zone via a second portal', async () => {
    const store = useRoomStore();
    // hynitos-ayousum is roads, hightree-isle is non-roads (slots:7, no customHandles)
    // Existing connection already links h-p1 → center
    store.connections = [
      {
        id: 'YC_SutyXDKGgg08nwWI78',
        roomId: 'test-room',
        fromZoneId: 'hynitos-ayousum',
        toZoneId: 'hightree-isle',
        fromHandleId: 'h-p1',
        toHandleId: 'center',
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

    // Mock reportForm.setConnection before the connect call
    const setConnectionMock = vi.fn();
    vm.reportForm = {
      setConnection: setConnectionMock,
      open: vi.fn(),
    };

    // User attempts to connect hynitos-ayousum's NW portal (h-p6) to hightree-isle's center
    await vm.handleConnect({
      source: 'hynitos-ayousum',
      sourceHandle: 'h-p6',
      target: 'hightree-isle',
      targetHandle: 'center',
    });

    // Should NOT show a confirmation modal — warning is inline in the Add Connection form
    expect(vm.showConfirmationModal).toBe(false);

    // Should open the Add Connection form with the multiple portal link warning
    expect(setConnectionMock).toHaveBeenCalledWith(
      'hynitos-ayousum',
      'h-p6',
      'hightree-isle',
      'center',
      expect.stringContaining('multiple portal link')
    );
    expect(setConnectionMock.mock.calls[0][4]).toContain('extremely');
  });

  it('does NOT show confirmation modal when reassigning roads-side handle to center on a roads→non-roads connection', async () => {
    const store = useRoomStore();
    // soros-axaesum is roads, nightcreak-marsh is non-roads
    // Existing connection uses s-p2 as the source handle; user reassigns to center
    store.connections = [
      {
        id: 'gKfdzU8EvQHVGLTx3Ze65',
        roomId: 'test-room',
        fromZoneId: 'soros-axaesum',
        toZoneId: 'nightcreak-marsh',
        fromHandleId: 's-p2',
        toHandleId: 'center',
        expiresAt: new Date(Date.now() + 1000000).toISOString(),
        reportedAt: new Date().toISOString(),
      }
    ];

    // Mock fetch so updateConnection succeeds
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as any);

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

    // User reassigns to center (one side is center → not a genuine second portal)
    await vm.handleConnect({
      source: 'soros-axaesum',
      sourceHandle: 'center',
      target: 'nightcreak-marsh',
      targetHandle: 'center',
    });

    // Should NOT show the confirmation modal — one side uses center, this is a handle replacement
    expect(vm.showConfirmationModal).toBe(false);
    expect(vm.toast).not.toBe("A non-roads zone cannot have multiple portal entrances to a roads zone.");
  });

  const STUBS = {
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
  };

  function mountRoom(pinia: any) {
    return mount(RoomView, {
      props: { id: 'test-room' },
      global: { plugins: [pinia], stubs: STUBS },
    });
  }

  it('allows moving the non-roads end of a roads↔non-roads connection onto an edge anchor, with a warning', async () => {
    const store = useRoomStore();
    // soros-axaesum is roads, nightcreak-marsh is royal (non-roads).
    // The connection currently lands on the non-roads zone's center anchor.
    store.connections = [
      {
        id: 'conn1',
        roomId: 'test-room',
        fromZoneId: 'soros-axaesum',
        toZoneId: 'nightcreak-marsh',
        fromHandleId: 's-p2',
        toHandleId: 'center',
        expiresAt: new Date(Date.now() + 1000000).toISOString(),
        reportedAt: new Date().toISOString(),
      }
    ];

    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as any);

    const wrapper = mountRoom(pinia);
    const vm = wrapper.vm as any;

    // Same roads portal, dragged onto the NW edge of the royal zone
    await vm.handleConnect({
      source: 'soros-axaesum',
      sourceHandle: 's-p2',
      target: 'nightcreak-marsh',
      targetHandle: 'nw',
    });

    expect(vm.toast).not.toBe("A non-roads zone cannot have multiple portal entrances to a roads zone.");
    expect(vm.toastType).toBe('warning');
    expect(vm.toast).toContain('Royal Continent edge');

    // The existing connection is reassigned rather than duplicated
    const patchCall = (global.fetch as any).mock.calls.find((c: any[]) => c[1]?.method === 'PATCH');
    expect(patchCall).toBeTruthy();
    expect(JSON.parse(patchCall[1].body)).toEqual({ fromHandleId: 's-p2', toHandleId: 'nw' });
  });

  it('does not warn when the non-roads end is moved back onto the center anchor', async () => {
    const store = useRoomStore();
    store.connections = [
      {
        id: 'conn1',
        roomId: 'test-room',
        fromZoneId: 'soros-axaesum',
        toZoneId: 'nightcreak-marsh',
        fromHandleId: 's-p2',
        toHandleId: 'nw',
        expiresAt: new Date(Date.now() + 1000000).toISOString(),
        reportedAt: new Date().toISOString(),
      }
    ];

    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as any);

    const wrapper = mountRoom(pinia);
    const vm = wrapper.vm as any;

    await vm.handleConnect({
      source: 'soros-axaesum',
      sourceHandle: 's-p2',
      target: 'nightcreak-marsh',
      targetHandle: 'center',
    });

    expect(vm.toast).toBe('');
  });

  it('still blocks a genuine duplicate: a different roads portal onto a different non-roads anchor', async () => {
    const store = useRoomStore();
    store.connections = [
      {
        id: 'conn1',
        roomId: 'test-room',
        fromZoneId: 'soros-axaesum',
        toZoneId: 'nightcreak-marsh',
        fromHandleId: 's-p2',
        toHandleId: 'nw',
        expiresAt: new Date(Date.now() + 1000000).toISOString(),
        reportedAt: new Date().toISOString(),
      }
    ];

    const wrapper = mountRoom(pinia);
    const vm = wrapper.vm as any;

    await vm.handleConnect({
      source: 'soros-axaesum',
      sourceHandle: 's-p5',
      target: 'nightcreak-marsh',
      targetHandle: 'se',
    });

    expect(vm.toast).toBe("A non-roads zone cannot have multiple portal entrances to a roads zone.");
    expect(vm.toastType).toBe('error');
  });

  it('warns when a brand-new roads connection is dropped on a non-roads edge anchor', async () => {
    const store = useRoomStore();
    store.connections = [];

    const wrapper = mountRoom(pinia);
    const vm = wrapper.vm as any;

    const setConnectionMock = vi.fn();
    vm.reportForm = { setConnection: setConnectionMock, open: vi.fn() };

    // hightree-isle is outlands (non-roads)
    await vm.handleConnect({
      source: 'hynitos-ayousum',
      sourceHandle: 'h-p1',
      target: 'hightree-isle',
      targetHandle: 'se',
    });

    expect(vm.toastType).toBe('warning');
    expect(vm.toast).toContain('Outlands edge');
    expect(setConnectionMock).toHaveBeenCalled();
  });
});
