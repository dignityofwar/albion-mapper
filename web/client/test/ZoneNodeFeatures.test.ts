import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ZoneNode from '../src/components/flow/ZoneNode.vue'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import { deleteConnection } from '../src/utils/roomOperations'
import { useRoomStore } from '../src/stores/useRoomStore'

vi.mock('../src/utils/roomOperations', () => ({
  deleteConnection: vi.fn(),
  updateConnection: vi.fn(),
  addConnection: vi.fn(),
}))

describe('ZoneNode Features and Styling', () => {
  const mountNode = (type: string, isHome = false) => {
    return mount(ZoneNode as any, {
      props: {
        id: 'test-node',
        type: 'zone',
        data: {
          type,
          isHome,
          tier: 5,
          zoneName: 'Test Zone',
        },
        selected: false,
        dragging: false,
        resizing: false,
        connectable: true,
        zIndex: 0,
        position: { x: 0, y: 0 },
        dimensions: { width: 160, height: 100 },
        events: {} as any,
      },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        provide: {
          globalNow: ref(Date.now()),
        },
        stubs: {
          Handle: true,
          TagTier: true,
          TagZone: true,
        }
      }
    })
  }

  describe('Feature Visibility', () => {
    it('hides features for royal zones', () => {
      const wrapper = mountNode('royalBlue')
      expect(wrapper.findComponent({ name: 'ZoneCoresAndReds' }).exists()).toBe(false)
    })

    it('hides features for outlands zones', () => {
      const wrapper = mountNode('outlands')
      expect(wrapper.findComponent({ name: 'ZoneCoresAndReds' }).exists()).toBe(false)
    })

    it('shows features for roads zones', () => {
      const wrapper = mountNode('roads')
      expect(wrapper.findComponent({ name: 'ZoneCoresAndReds' }).exists()).toBe(true)
    })
    
    it('shows features for roadsHideout zones', () => {
      const wrapper = mountNode('roadsHideout')
      expect(wrapper.findComponent({ name: 'ZoneCoresAndReds' }).exists()).toBe(true)
    })
  })

  describe('Handle Color for Expired/Isolated Nodes', () => {
    beforeEach(() => {
      setActivePinia(createPinia());
    });

    it('applies handle-edge-grey class when the connected edge is expired (isExpired: true)', async () => {
      const store = useRoomStore();
      const now = Date.now();
      const expiresAt = new Date(now + 3600000).toISOString();

      store.applyMessage({
        type: 'sync',
        connections: [
          {
            id: 'conn1',
            roomId: 'r1',
            fromZoneId: 'zone-a',
            toZoneId: 'zone-b',
            fromHandleId: 'e',
            expiresAt,
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
      });

      const wrapper = mount(ZoneNode as any, {
        props: {
          id: 'zone-a',
          type: 'zone',
          data: {
            type: 'roads',
            isHome: true,
            tier: 5,
            zoneName: 'Zone A',
            customHandles: [{ id: 'e', left: '100%', top: '50%' }],
          },
          selected: false,
          dragging: false,
          resizing: false,
          connectable: true,
          zIndex: 0,
          position: { x: 0, y: 0 },
          dimensions: { width: 160, height: 100 },
          events: {} as any,
        },
        global: {
          provide: {
            globalNow: ref(now),
          },
          stubs: {
            Handle: true,
            TagTier: true,
            TagZone: true,
          },
        },
      });

      const handles = wrapper.findAll('handle-stub');
      const expiredHandle = handles.find(h => h.classes('handle-edge-grey'));
      expect(expiredHandle).toBeDefined();
    });

    it('applies handle-edge-grey class when the node is isolated (only connection is expired)', async () => {
      const store = useRoomStore();
      const now = Date.now();
      const expiredAt = new Date(now - 1000).toISOString(); // already expired

      store.applyMessage({
        type: 'sync',
        connections: [
          {
            id: 'conn-expired',
            roomId: 'r1',
            fromZoneId: 'zone-a',
            toZoneId: 'zone-b',
            fromHandleId: 'e',
            expiresAt: expiredAt,
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
      });

      // zone-a is isolated because its only connection is time-expired
      expect(store.isNodeIsolated('zone-a', now)).toBe(true);

      const wrapper = mount(ZoneNode as any, {
        props: {
          id: 'zone-a',
          type: 'zone',
          data: {
            type: 'roads',
            isHome: false,
            tier: 5,
            zoneName: 'Zone A',
            customHandles: [{ id: 'e', left: '100%', top: '50%' }],
          },
          selected: false,
          dragging: false,
          resizing: false,
          connectable: true,
          zIndex: 0,
          position: { x: 0, y: 0 },
          dimensions: { width: 160, height: 100 },
          events: {} as any,
        },
        global: {
          provide: {
            globalNow: ref(now),
          },
          stubs: {
            Handle: true,
            TagTier: true,
            TagZone: true,
          },
        },
      });

      const handles = wrapper.findAll('handle-stub');
      const greyHandle = handles.find(h => h.classes('handle-edge-grey'));
      expect(greyHandle).toBeDefined();
    });
  });

  describe('Home Zone Styling', () => {
    it('applies glow for home zones', () => {
      const wrapper = mountNode('roads', true)
      const nodeDiv = wrapper.find('.min-w-\\[400px\\]')
      expect(nodeDiv.classes()).not.toContain('border-[3px]')
      expect(nodeDiv.classes()).toContain('home-glow')
    })

    it('does not apply 3px border for home zones', () => {
      const wrapper = mountNode('roads', true)
      const nodeDiv = wrapper.find('.min-w-\\[400px\\]')
      expect(nodeDiv.classes()).not.toContain('border-[3px]')
    })

    it('renders TagTier badge for home zones', () => {
      const wrapper = mountNode('roads', true)
      expect(wrapper.findComponent({ name: 'TagTier' }).exists()).toBe(true)
    })
  })
})
