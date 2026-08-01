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

describe('RoomView - Multiple Connections', () => {
  let pinia: any;
  const mountRoom = () => mount(RoomView, {
    props: { id: 'test-room' },
    global: { plugins: [pinia], stubs: STUBS },
  });

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

  it('reassigns the non-roads end of an existing connection onto an edge handle (roads handle pinned)', async () => {
    const store = useRoomStore();
    // hynitos-ayousum is roads, nightcreak-marsh is royal (non-roads).
    // The zone was added by dragging, so the non-roads end sits on `center`; the user now
    // drags that same roads portal onto the marsh's NW edge to tidy the layout up.
    store.connections = [
      {
        id: 'conn1',
        roomId: 'test-room',
        fromZoneId: 'hynitos-ayousum',
        toZoneId: 'nightcreak-marsh',
        fromHandleId: 'h-p1',
        toHandleId: 'center',
        expiresAt: new Date(Date.now() + 1000000).toISOString(),
        reportedAt: new Date().toISOString(),
      }
    ];

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as any);
    global.fetch = fetchMock as any;

    const wrapper = mountRoom();
    const vm = wrapper.vm as any;

    await vm.handleConnect({
      source: 'hynitos-ayousum',
      sourceHandle: 'h-p1',
      target: 'nightcreak-marsh',
      targetHandle: 'nw',
    });

    // Reassignment, not a second entrance — no error, and the existing connection is patched
    expect(vm.toastType).not.toBe('error');
    const patchCall = fetchMock.mock.calls.find(([, init]: any[]) => init?.method === 'PATCH');
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall![1].body)).toMatchObject({ fromHandleId: 'h-p1', toHandleId: 'nw' });

    // …but the user is warned that the edge is now spoken for
    expect(vm.toastType).toBe('warning');
    expect(vm.toast).toContain('Royal Continent');
    expect(vm.toast).toContain('entire edge');
  });

  it('reassigns the non-roads end when the drag starts from the non-roads edge handle', async () => {
    const store = useRoomStore();
    // Same reassignment, dragged the other way round: from the Outlands zone's edge handle
    // back to the roads portal the connection already uses.
    store.connections = [
      {
        id: 'conn1',
        roomId: 'test-room',
        fromZoneId: 'hynitos-ayousum',
        toZoneId: 'hightree-isle',
        fromHandleId: 'h-p1',
        toHandleId: 'center',
        expiresAt: new Date(Date.now() + 1000000).toISOString(),
        reportedAt: new Date().toISOString(),
      }
    ];

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as any);
    global.fetch = fetchMock as any;

    const wrapper = mountRoom();
    const vm = wrapper.vm as any;

    await vm.handleConnect({
      source: 'hightree-isle',
      sourceHandle: 'se',
      target: 'hynitos-ayousum',
      targetHandle: 'h-p1',
    });

    expect(vm.toastType).not.toBe('error');
    const patchCall = fetchMock.mock.calls.find(([, init]: any[]) => init?.method === 'PATCH');
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall![1].body)).toMatchObject({ fromHandleId: 'h-p1', toHandleId: 'se' });

    // hightree-isle is an Outlands zone — the warning names the right region
    expect(vm.toastType).toBe('warning');
    expect(vm.toast).toContain('Outlands');
  });

  it('still blocks a second entrance when both ends of a roads↔non-roads connection move', async () => {
    const store = useRoomStore();
    // Existing connection already sits on the marsh's NW edge; the user now drags a
    // different roads portal onto a different edge — a genuine second entrance.
    store.connections = [
      {
        id: 'conn1',
        roomId: 'test-room',
        fromZoneId: 'hynitos-ayousum',
        toZoneId: 'nightcreak-marsh',
        fromHandleId: 'h-p1',
        toHandleId: 'nw',
        expiresAt: new Date(Date.now() + 1000000).toISOString(),
        reportedAt: new Date().toISOString(),
      }
    ];

    const wrapper = mountRoom();
    const vm = wrapper.vm as any;

    await vm.handleConnect({
      source: 'hynitos-ayousum',
      sourceHandle: 'h-p4',
      target: 'nightcreak-marsh',
      targetHandle: 'se',
    });

    expect(vm.toast).toBe("A non-roads zone cannot have multiple portal entrances to a roads zone.");
    expect(vm.toastType).toBe('error');
  });

  it('warns about the blocked edge when a brand-new connection targets a non-roads edge handle', async () => {
    const store = useRoomStore();
    // No connection between this pair yet — the drag opens the Add Connection form,
    // and the edge warning rides along with it.
    store.connections = [
      {
        id: 'conn1',
        roomId: 'test-room',
        fromZoneId: 'xerites-oxoulum',
        toZoneId: 'hynitos-ayousum',
        fromHandleId: 'x-p4',
        toHandleId: 'h-p3',
        expiresAt: new Date(Date.now() + 1000000).toISOString(),
        reportedAt: new Date().toISOString(),
      }
    ];

    const wrapper = mountRoom();
    const vm = wrapper.vm as any;

    const setConnectionMock = vi.fn();
    vm.reportForm = { setConnection: setConnectionMock, open: vi.fn() };

    await vm.handleConnect({
      source: 'hynitos-ayousum',
      sourceHandle: 'h-p1',
      target: 'nightcreak-marsh',
      targetHandle: 'ne',
    });

    expect(setConnectionMock).toHaveBeenCalledWith(
      'hynitos-ayousum', 'h-p1', 'nightcreak-marsh', 'ne', expect.anything()
    );
    expect(vm.toastType).toBe('warning');
    expect(vm.toast).toContain('entire edge');
  });

  it('does not warn when a roads connection lands on the non-roads centre handle', async () => {
    const store = useRoomStore();
    store.connections = [];

    const wrapper = mountRoom();
    const vm = wrapper.vm as any;

    const setConnectionMock = vi.fn();
    vm.reportForm = { setConnection: setConnectionMock, open: vi.fn() };

    await vm.handleConnect({
      source: 'hynitos-ayousum',
      sourceHandle: 'h-p1',
      target: 'nightcreak-marsh',
      targetHandle: 'center',
    });

    expect(setConnectionMock).toHaveBeenCalled();
    expect(vm.toast).toBe('');
  });
});
