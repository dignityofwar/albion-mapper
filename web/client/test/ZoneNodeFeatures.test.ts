import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ZoneNode from '../src/components/flow/ZoneNode.vue'
import { createTestingPinia } from '@pinia/testing'
import { ref } from 'vue'
import { deleteConnection } from '../src/utils/roomOperations'

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

  describe('Handle Connection Deletion', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('deletes connections when a handle is disabled', async () => {
      const wrapper = mountNode('roads')
      const store = (wrapper.vm as any).store
      
      // Setup store with connections
      store.connections = [
        { id: 'conn1', fromZoneId: 'test-node', fromHandleId: 'h1', toZoneId: 'other', toHandleId: 'h2', expiresAt: Date.now() + 10000 },
        { id: 'conn2', fromZoneId: 'test-node', fromHandleId: 'h2', toZoneId: 'other', toHandleId: 'h3', expiresAt: Date.now() + 10000 },
      ]
      store.roomId = 'room1'
      store.token = 'token1'

      // Mock new handles where h1 is disabled
      const newHandles = [
        { id: 'h1', left: '50.00%', top: '0.00%', disabled: true },
        { id: 'h2', left: '100.00%', top: '50.00%', disabled: false },
      ]

      // Trigger saveCustomHandles
      await (wrapper.vm as any).saveCustomHandles(newHandles)

      expect(deleteConnection).toHaveBeenCalledWith('room1', 'token1', 'conn1')
      expect(deleteConnection).not.toHaveBeenCalledWith('room1', 'token1', 'conn2')
    })

    it('sets connectable false and is-disabled class for deactivated handles', async () => {
      const customHandles = [
        { id: 'h1', left: '50.00%', top: '0.00%', disabled: true },
        { id: 'h2', left: '100.00%', top: '50.00%', disabled: false },
      ]
      
      const wrapper = mount(ZoneNode as any, {
        props: {
          id: 'test-node',
          type: 'zone',
          data: {
            type: 'roads',
            customHandles,
            mapShape: 'diamond',
            tier: 5,
            zoneName: 'Test'
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
            showToast: vi.fn()
          },
          stubs: {
            Handle: true,
            TagTier: true,
            TagZone: true,
            ZoneCoresAndReds: true,
            ZoneFeatures: true,
            ZoneEditorTray: true,
            ZoneHandleEditor: true,
            TooltipProvider: true,
          }
        }
      })

      // Verify computed property first
      const renderedHandles = (wrapper.vm as any).customHandles
      expect(renderedHandles.length).toBe(2)
      expect(renderedHandles.find((h: any) => h.id === 'h1').disabled).toBe(true)
      expect(renderedHandles.find((h: any) => h.id === 'h2').disabled).toBe(false)
    })
  })
})
