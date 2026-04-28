import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import ZoneNode from '../src/components/flow/ZoneNode.vue'
import { createTestingPinia } from '@pinia/testing'
import { ref } from 'vue'

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
      expect(wrapper.find('button[title="Green Core"]').exists()).toBe(false)
    })

    it('hides features for outlands zones', () => {
      const wrapper = mountNode('outlands')
      expect(wrapper.find('button[title="Green Core"]').exists()).toBe(false)
    })

    it('shows features for roads zones', () => {
      const wrapper = mountNode('roads')
      expect(wrapper.find('button[title="Green Core"]').exists()).toBe(true)
    })
    
    it('shows features for roadsHideout zones', () => {
      const wrapper = mountNode('roadsHideout')
      expect(wrapper.find('button[title="Green Core"]').exists()).toBe(true)
    })
  })

  describe('Home Zone Styling', () => {
    it('applies glow for home zones', () => {
      const wrapper = mountNode('roads', true)
      const nodeDiv = wrapper.find('.min-w-\\[230px\\]')
      expect(nodeDiv.classes()).not.toContain('border-[3px]')
      expect(nodeDiv.classes()).toContain('shadow-[0_0_10px_rgba(255,255,255,0.5)]')
    })

    it('does not apply 3px border for home zones', () => {
      const wrapper = mountNode('roads', true)
      const nodeDiv = wrapper.find('.min-w-\\[230px\\]')
      expect(nodeDiv.classes()).not.toContain('border-[3px]')
    })

    it('keeps TagTier badge position for home zones', () => {
      const wrapper = mountNode('roads', true)
      const badgeContainer = wrapper.find('.absolute.z-10')
      expect(badgeContainer.classes()).toContain('-top-[1px]')
      expect(badgeContainer.classes()).toContain('-left-[1px]')
    })
  })
})
