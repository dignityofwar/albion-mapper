import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ZoneNode from '../src/components/flow/ZoneNode.vue';
import { setActivePinia, createPinia } from 'pinia';
import { ref, nextTick } from 'vue';
import { useRoomStore } from '../src/stores/useRoomStore';

vi.mock('../src/utils/roomOperations', () => ({
  deleteConnection: vi.fn(),
  deleteNode: vi.fn(),
  updateConnection: vi.fn(),
  addConnection: vi.fn(),
}));

import { deleteConnection, deleteNode } from '../src/utils/roomOperations';

// Helper: make deleteConnection simulate the server broadcasting connection_removed
// by applying the message to the store after each call. After each removal, if a
// zone has no remaining connections the server also sends node_positions_updated
// dropping that zone — we simulate that too so the overlay disappears from the DOM.
function simulateServerDelete(store: ReturnType<typeof useRoomStore>) {
  vi.mocked(deleteConnection).mockImplementation(async (_roomId, _token, connId) => {
    store.applyMessage({ type: 'connection_removed', connectionId: connId });

    // Determine which zones now have no connections and remove them from nodePositions
    const remaining = store.connections;
    const connectedZones = new Set<string>();
    for (const c of remaining) {
      connectedZones.add(c.fromZoneId);
      connectedZones.add(c.toZoneId);
    }
    const newPositions = store.nodePositions.filter(
      p => p.zoneId === store.homeZoneId || connectedZones.has(p.zoneId)
    );
    store.applyMessage({ type: 'node_positions_updated', nodePositions: newPositions });
  });
}

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

function mountZoneNode(id: string, isHome: boolean, now: number) {
  return mount(ZoneNode as any, {
    props: {
      ...BASE_PROPS,
      id,
      data: {
        type: 'roads',
        isHome,
        tier: 5,
        zoneName: 'Test Zone',
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
}

describe('ZoneNode Delete Overlay', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // ─── Expired node ────────────────────────────────────────────────────────────

  describe('expired node', () => {
    it('shows the delete overlay when an expired node is clicked', async () => {
      const now = Date.now();
      const store = useRoomStore();
      store.setCredentials('room1', 'token1');

      // zone-b has a connection that is expired (isExpired flag), making it an expired node
      store.applyMessage({
        type: 'sync',
        connections: [
          {
            id: 'conn-exp',
            roomId: 'room1',
            fromZoneId: 'zone-a',
            toZoneId: 'zone-b',
            fromHandleId: 'e',
            expiresAt: new Date(now + 3600000).toISOString(),
            reportedAt: new Date().toISOString(),
            isExpired: true,
          },
        ],
        homeZoneId: 'zone-a',
        nodePositions: [
          { zoneId: 'zone-a', x: 0, y: 0 },
          { zoneId: 'zone-b', x: 100, y: 0 },
        ],
        lastUpdatedAt: new Date().toISOString(),
        watching: 0, totalConnected: 0,
      });

      expect(store.isNodeExpired('zone-b', now)).toBe(true);

      const wrapper = mountZoneNode('zone-b', false, now);

      // The overlay div is present but the inner prompt is hidden until clicked
      const overlay = wrapper.find('[class*="absolute inset-0 cursor-pointer"]');
      expect(overlay.exists()).toBe(true);

      // Prompt not yet visible
      expect(wrapper.text()).not.toContain('Node is expired. Delete it?');

      // Click the overlay to reveal the delete prompt
      await overlay.trigger('click');
      await nextTick();

      expect(wrapper.text()).toContain('Node is expired. Delete it?');
      expect(wrapper.find('button.bg-red-600').exists()).toBe(true);
    });

    it('calls deleteConnection for all connections when Delete is clicked on an expired node, and the node is removed from the DOM', async () => {
      const now = Date.now();
      const store = useRoomStore();
      store.setCredentials('room1', 'token1');
      simulateServerDelete(store);

      // zone-a -> zone-b (expired) -> zone-c
      store.applyMessage({
        type: 'sync',
        connections: [
          {
            id: 'conn-1',
            roomId: 'room1',
            fromZoneId: 'zone-a',
            toZoneId: 'zone-b',
            fromHandleId: 'e',
            expiresAt: new Date(now + 3600000).toISOString(),
            reportedAt: new Date().toISOString(),
            isExpired: true,
          },
          {
            id: 'conn-2',
            roomId: 'room1',
            fromZoneId: 'zone-b',
            toZoneId: 'zone-c',
            fromHandleId: 'e',
            expiresAt: new Date(now + 3600000).toISOString(),
            reportedAt: new Date().toISOString(),
            isExpired: true,
          },
        ],
        homeZoneId: 'zone-a',
        nodePositions: [
          { zoneId: 'zone-a', x: 0, y: 0 },
          { zoneId: 'zone-b', x: 100, y: 0 },
          { zoneId: 'zone-c', x: 200, y: 0 },
        ],
        lastUpdatedAt: new Date().toISOString(),
        watching: 0, totalConnected: 0,
      });

      expect(store.isNodeExpired('zone-b', now)).toBe(true);

      const wrapper = mountZoneNode('zone-b', false, now);

      // Open the delete overlay
      const overlay = wrapper.find('[class*="absolute inset-0 cursor-pointer"]');
      await overlay.trigger('click');
      await nextTick();

      // Click Delete
      const deleteBtn = wrapper.find('button.bg-red-600');
      expect(deleteBtn.exists()).toBe(true);
      await deleteBtn.trigger('click');
      await nextTick();

      // Both connections (incoming conn-1 and outgoing conn-2) must be deleted
      expect(deleteConnection).toHaveBeenCalledWith('room1', 'token1', 'conn-1');
      expect(deleteConnection).toHaveBeenCalledWith('room1', 'token1', 'conn-2');
      expect(vi.mocked(deleteConnection).mock.calls.length).toBe(2);

      // After the server processes the deletes, zone-b must be removed from
      // nodePositions (the server sends node_positions_updated) so it disappears
      // from the flow entirely.
      await nextTick();
      expect(store.nodePositions.find(p => p.zoneId === 'zone-b')).toBeUndefined();
    });
  });

  // ─── Orphaned node (zero connections) ───────────────────────────────────────

  describe('orphaned node (no connections at all)', () => {
    it('shows the delete overlay when an orphaned node is clicked', async () => {
      const now = Date.now();
      const store = useRoomStore();
      store.setCredentials('room1', 'token1');

      store.applyMessage({
        type: 'sync',
        connections: [],
        homeZoneId: 'home',
        nodePositions: [
          { zoneId: 'home', x: 0, y: 0 },
          { zoneId: 'zone-orphan', x: 100, y: 0 },
        ],
        lastUpdatedAt: new Date().toISOString(),
        watching: 0, totalConnected: 0,
      });

      expect(store.isNodeIsolated('zone-orphan', now)).toBe(true);

      const wrapper = mountZoneNode('zone-orphan', false, now);

      const overlay = wrapper.find('[class*="absolute inset-0 cursor-pointer"]');
      expect(overlay.exists()).toBe(true);

      await overlay.trigger('click');
      await nextTick();

      expect(wrapper.text()).toContain('Node is expired. Delete it?');
      expect(wrapper.find('button.bg-red-600').exists()).toBe(true);
    });

    it('calls deleteNode (not deleteConnection) when Delete is clicked on an orphaned node, and the node is removed', async () => {
      const now = Date.now();
      const store = useRoomStore();
      store.setCredentials('room1', 'token1');

      vi.mocked(deleteNode).mockImplementation(async (_roomId, _token, zoneId) => {
        const newPositions = store.nodePositions.filter(p => p.zoneId !== zoneId);
        store.applyMessage({ type: 'node_positions_updated', nodePositions: newPositions });
      });

      store.applyMessage({
        type: 'sync',
        connections: [],
        homeZoneId: 'home',
        nodePositions: [
          { zoneId: 'home', x: 0, y: 0 },
          { zoneId: 'zone-orphan', x: 100, y: 0 },
        ],
        lastUpdatedAt: new Date().toISOString(),
        watching: 0, totalConnected: 0,
      });

      const wrapper = mountZoneNode('zone-orphan', false, now);

      const overlay = wrapper.find('[class*="absolute inset-0 cursor-pointer"]');
      await overlay.trigger('click');
      await nextTick();

      const deleteBtn = wrapper.find('button.bg-red-600');
      await deleteBtn.trigger('click');
      await nextTick();

      expect(deleteNode).toHaveBeenCalledWith('room1', 'token1', 'zone-orphan');
      expect(deleteConnection).not.toHaveBeenCalled();

      await nextTick();
      expect(store.nodePositions.find(p => p.zoneId === 'zone-orphan')).toBeUndefined();
    });
  });

  // ─── Node with children ──────────────────────────────────────────────────────

  describe('node with children (parent node whose children should also be deleted)', () => {
    it('shows the delete overlay when a parent node with children is clicked', async () => {
      const now = Date.now();
      const store = useRoomStore();
      store.setCredentials('test4', 'token1');

      // qiient-al-nusom -> cebitos-aeaylum -> curlew-fen
      //                                    -> cebos-avemlum
      store.applyMessage({
        type: 'sync',
        connections: [
          {
            id: 'b63bc530-7b52-4602-b954-73a90bdcf3cb',
            roomId: 'test4',
            fromZoneId: 'qiient-al-nusom',
            toZoneId: 'cebitos-aeaylum',
            fromHandleId: 'n',
            toHandleId: 'center',
            expiresAt: new Date(now + 3600000).toISOString(),
            reportedAt: new Date().toISOString(),
            isExpired: true,
          },
          {
            id: '55b01aa9-bc4a-4c2b-b7d1-ef795765a2b8',
            roomId: 'test4',
            fromZoneId: 'cebitos-aeaylum',
            toZoneId: 'curlew-fen',
            fromHandleId: 'c-p6',
            toHandleId: 'center',
            expiresAt: new Date(now + 3600000).toISOString(),
            reportedAt: new Date().toISOString(),
          },
          {
            id: '2f01830f-c1c3-4d7c-881d-1fb8602e5df8',
            roomId: 'test4',
            fromZoneId: 'cebitos-aeaylum',
            toZoneId: 'cebos-avemlum',
            fromHandleId: 'c-p1',
            toHandleId: 'center',
            expiresAt: new Date(now + 3600000).toISOString(),
            reportedAt: new Date().toISOString(),
          },
        ],
        homeZoneId: 'qiient-al-nusom',
        nodePositions: [
          { zoneId: 'qiient-al-nusom', x: 90, y: 40 },
          { zoneId: 'cebitos-aeaylum', x: 524, y: -483 },
          { zoneId: 'curlew-fen', x: 1195, y: -128 },
          { zoneId: 'cebos-avemlum', x: 520, y: -937 },
        ],
        lastUpdatedAt: new Date().toISOString(),
        watching: 0, totalConnected: 0,
      });

      expect(store.isNodeExpired('cebitos-aeaylum', now)).toBe(true);

      const wrapper = mountZoneNode('cebitos-aeaylum', false, now);

      const overlay = wrapper.find('[class*="absolute inset-0 cursor-pointer"]');
      expect(overlay.exists()).toBe(true);

      expect(wrapper.text()).not.toContain('Node is expired. Delete it?');

      await overlay.trigger('click');
      await nextTick();

      expect(wrapper.text()).toContain('Node is expired. Delete it?');
      expect(wrapper.find('button.bg-red-600').exists()).toBe(true);
    });

    it('deletes all 3 connections and removes child nodes from nodePositions when Delete is clicked', async () => {
      const now = Date.now();
      const store = useRoomStore();
      store.setCredentials('test4', 'token1');
      simulateServerDelete(store);

      // qiient-al-nusom -> cebitos-aeaylum -> curlew-fen
      //                                    -> cebos-avemlum
      store.applyMessage({
        type: 'sync',
        connections: [
          {
            id: 'b63bc530-7b52-4602-b954-73a90bdcf3cb',
            roomId: 'test4',
            fromZoneId: 'qiient-al-nusom',
            toZoneId: 'cebitos-aeaylum',
            fromHandleId: 'n',
            toHandleId: 'center',
            expiresAt: new Date(now + 3600000).toISOString(),
            reportedAt: new Date().toISOString(),
            isExpired: true,
          },
          {
            id: '55b01aa9-bc4a-4c2b-b7d1-ef795765a2b8',
            roomId: 'test4',
            fromZoneId: 'cebitos-aeaylum',
            toZoneId: 'curlew-fen',
            fromHandleId: 'c-p6',
            toHandleId: 'center',
            expiresAt: new Date(now + 3600000).toISOString(),
            reportedAt: new Date().toISOString(),
          },
          {
            id: '2f01830f-c1c3-4d7c-881d-1fb8602e5df8',
            roomId: 'test4',
            fromZoneId: 'cebitos-aeaylum',
            toZoneId: 'cebos-avemlum',
            fromHandleId: 'c-p1',
            toHandleId: 'center',
            expiresAt: new Date(now + 3600000).toISOString(),
            reportedAt: new Date().toISOString(),
          },
        ],
        homeZoneId: 'qiient-al-nusom',
        nodePositions: [
          { zoneId: 'qiient-al-nusom', x: 90, y: 40 },
          { zoneId: 'cebitos-aeaylum', x: 524, y: -483 },
          { zoneId: 'curlew-fen', x: 1195, y: -128 },
          { zoneId: 'cebos-avemlum', x: 520, y: -937 },
        ],
        lastUpdatedAt: new Date().toISOString(),
        watching: 0, totalConnected: 0,
      });

      expect(store.isNodeExpired('cebitos-aeaylum', now)).toBe(true);

      const wrapper = mountZoneNode('cebitos-aeaylum', false, now);

      const overlay = wrapper.find('[class*="absolute inset-0 cursor-pointer"]');
      await overlay.trigger('click');
      await nextTick();

      const deleteBtn = wrapper.find('button.bg-red-600');
      expect(deleteBtn.exists()).toBe(true);
      await deleteBtn.trigger('click');
      await nextTick();

      // All 3 connections must be deleted
      expect(deleteConnection).toHaveBeenCalledWith('test4', 'token1', 'b63bc530-7b52-4602-b954-73a90bdcf3cb');
      expect(deleteConnection).toHaveBeenCalledWith('test4', 'token1', '55b01aa9-bc4a-4c2b-b7d1-ef795765a2b8');
      expect(deleteConnection).toHaveBeenCalledWith('test4', 'token1', '2f01830f-c1c3-4d7c-881d-1fb8602e5df8');
      expect(vi.mocked(deleteConnection).mock.calls.length).toBe(3);

      // After deletion, cebitos-aeaylum and its children (curlew-fen, cebos-avemlum)
      // must all be removed from nodePositions — only the home zone remains.
      await nextTick();
      expect(store.nodePositions.find(p => p.zoneId === 'cebitos-aeaylum')).toBeUndefined();
      expect(store.nodePositions.find(p => p.zoneId === 'curlew-fen')).toBeUndefined();
      expect(store.nodePositions.find(p => p.zoneId === 'cebos-avemlum')).toBeUndefined();
      expect(store.nodePositions.find(p => p.zoneId === 'qiient-al-nusom')).toBeDefined();
    });
  });

  // ─── Handle editor / shaped road rotation ────────────────────────────────────

  describe('saveCustomHandles', () => {
    it('does not cascade-delete downstream connections when a handle is disabled', async () => {
      const now = Date.now();
      const store = useRoomStore();
      store.setCredentials('room1', 'token1');
      simulateServerDelete(store);

      // shaped-road has handle 'c-p1' connected to zone-b (conn-ab).
      // zone-b also has an outgoing connection to zone-c (conn-bc).
      // Disabling 'c-p1' should only delete conn-ab, NOT conn-bc.
      store.applyMessage({
        type: 'sync',
        connections: [
          {
            id: 'conn-ab',
            roomId: 'room1',
            fromZoneId: 'shaped-road',
            toZoneId: 'zone-b',
            fromHandleId: 'c-p1',
            expiresAt: new Date(now + 3600000).toISOString(),
            reportedAt: new Date().toISOString(),
          },
          {
            id: 'conn-bc',
            roomId: 'room1',
            fromZoneId: 'zone-b',
            toZoneId: 'zone-c',
            fromHandleId: 'e',
            expiresAt: new Date(now + 3600000).toISOString(),
            reportedAt: new Date().toISOString(),
          },
        ],
        homeZoneId: 'home',
        nodePositions: [
          { zoneId: 'home', x: 0, y: 0 },
          { zoneId: 'shaped-road', x: 100, y: 0 },
          { zoneId: 'zone-b', x: 200, y: 0 },
          { zoneId: 'zone-c', x: 300, y: 0 },
        ],
        lastUpdatedAt: new Date().toISOString(),
        watching: 0, totalConnected: 0,
      });

      const wrapper = mount(ZoneNode as any, {
        props: {
          ...BASE_PROPS,
          id: 'shaped-road',
          data: {
            type: 'roads',
            isHome: false,
            tier: 5,
            zoneName: 'Shaped Road',
            mapShape: 'c',
            customHandles: [
              { id: 'c-p1', left: '33.79%', top: '16.21%' },
              { id: 'c-p2', left: '7.62%', top: '42.38%' },
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

      // Directly call saveCustomHandles with c-p1 disabled
      await (wrapper.vm as any).saveCustomHandles([
        { id: 'c-p1', left: '33.79%', top: '16.21%', disabled: true },
        { id: 'c-p2', left: '7.62%', top: '42.38%' },
      ]);

      // Only conn-ab (the connection on the disabled handle) should be deleted
      expect(deleteConnection).toHaveBeenCalledWith('room1', 'token1', 'conn-ab');
      expect(vi.mocked(deleteConnection).mock.calls.length).toBe(1);

      // zone-b and zone-c must still exist in nodePositions
      await nextTick();
      expect(store.nodePositions.find(p => p.zoneId === 'zone-b')).toBeDefined();
      expect(store.nodePositions.find(p => p.zoneId === 'zone-c')).toBeDefined();
    });
  });

  // ─── Isolated node ───────────────────────────────────────────────────────────

  describe('isolated node', () => {
    it('shows the delete overlay when an isolated node is clicked', async () => {
      const now = Date.now();
      const store = useRoomStore();
      store.setCredentials('room1', 'token1');

      // zone-b is isolated: its only connection has already time-expired
      store.applyMessage({
        type: 'sync',
        connections: [
          {
            id: 'conn-iso',
            roomId: 'room1',
            fromZoneId: 'zone-a',
            toZoneId: 'zone-b',
            fromHandleId: 'e',
            expiresAt: new Date(now - 1000).toISOString(), // already past
            reportedAt: new Date().toISOString(),
          },
        ],
        homeZoneId: 'home',
        nodePositions: [
          { zoneId: 'home', x: 0, y: 0 },
          { zoneId: 'zone-a', x: 100, y: 0 },
          { zoneId: 'zone-b', x: 200, y: 0 },
        ],
        lastUpdatedAt: new Date().toISOString(),
        watching: 0, totalConnected: 0,
      });

      expect(store.isNodeIsolated('zone-b', now)).toBe(true);

      const wrapper = mountZoneNode('zone-b', false, now);

      const overlay = wrapper.find('[class*="absolute inset-0 cursor-pointer"]');
      expect(overlay.exists()).toBe(true);

      expect(wrapper.text()).not.toContain('Node is expired. Delete it?');

      await overlay.trigger('click');
      await nextTick();

      expect(wrapper.text()).toContain('Node is expired. Delete it?');
      expect(wrapper.find('button.bg-red-600').exists()).toBe(true);
    });

    it('calls deleteConnection for all connections when Delete is clicked on an isolated node, and the node is removed from the DOM', async () => {
      const now = Date.now();
      const store = useRoomStore();
      store.setCredentials('room1', 'token1');
      simulateServerDelete(store);

      // zone-b is isolated; it also has an outgoing connection to zone-c
      store.applyMessage({
        type: 'sync',
        connections: [
          {
            id: 'conn-iso',
            roomId: 'room1',
            fromZoneId: 'zone-a',
            toZoneId: 'zone-b',
            fromHandleId: 'e',
            expiresAt: new Date(now - 1000).toISOString(),
            reportedAt: new Date().toISOString(),
          },
          {
            id: 'conn-child',
            roomId: 'room1',
            fromZoneId: 'zone-b',
            toZoneId: 'zone-c',
            fromHandleId: 'e',
            expiresAt: new Date(now - 1000).toISOString(),
            reportedAt: new Date().toISOString(),
          },
        ],
        homeZoneId: 'home',
        nodePositions: [
          { zoneId: 'home', x: 0, y: 0 },
          { zoneId: 'zone-a', x: 100, y: 0 },
          { zoneId: 'zone-b', x: 200, y: 0 },
          { zoneId: 'zone-c', x: 300, y: 0 },
        ],
        lastUpdatedAt: new Date().toISOString(),
        watching: 0, totalConnected: 0,
      });

      expect(store.isNodeIsolated('zone-b', now)).toBe(true);

      const wrapper = mountZoneNode('zone-b', false, now);

      const overlay = wrapper.find('[class*="absolute inset-0 cursor-pointer"]');
      await overlay.trigger('click');
      await nextTick();

      const deleteBtn = wrapper.find('button.bg-red-600');
      expect(deleteBtn.exists()).toBe(true);
      await deleteBtn.trigger('click');
      await nextTick();

      // Both the incoming and outgoing connections must be deleted
      expect(deleteConnection).toHaveBeenCalledWith('room1', 'token1', 'conn-iso');
      expect(deleteConnection).toHaveBeenCalledWith('room1', 'token1', 'conn-child');
      expect(vi.mocked(deleteConnection).mock.calls.length).toBe(2);

      // After the server processes the deletes, zone-b must be removed from
      // nodePositions (the server sends node_positions_updated) so it disappears
      // from the flow entirely.
      await nextTick();
      expect(store.nodePositions.find(p => p.zoneId === 'zone-b')).toBeUndefined();
    });
  });
});
