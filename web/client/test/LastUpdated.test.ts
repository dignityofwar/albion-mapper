import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import ZoneNode from '../src/components/flow/ZoneNode.vue'
import { createTestingPinia } from '@pinia/testing'
import { ref } from 'vue'

describe('Last Updated Text and Color', () => {
  const mountNode = (features: any = {}, now: number = Date.now()) => {
    return mount(ZoneNode as any, {
      props: {
        id: 'test-node',
        type: 'zone',
        data: {
          type: 'roads',
          isHome: false,
          tier: 5,
          zoneName: 'Test Zone',
          features
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
          globalNow: ref(now),
          showToast: vi.fn()
        },
        stubs: {
          Handle: true,
          TagTier: true,
          TagZone: true,
        }
      }
    })
  }

  it('does not show updated label when lastUpdatedAt is not set', () => {
    const wrapper = mountNode({})
    expect(wrapper.find('[class*="text-green"]').exists()).toBe(false)
    expect(wrapper.find('[class*="text-orange"]').exists()).toBe(false)
    expect(wrapper.find('[class*="text-red"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Updated:')
  })

  it('shows "Updated: just now" when updated less than 1 minute ago', () => {
    const now = 1000000
    const features = { lastUpdatedAt: now - 30000 } // 30 seconds ago
    const wrapper = mountNode(features, now)
    expect(wrapper.text()).toContain('Updated: just now')
  })

  it('shows minutes ago when updated between 1 and 59 minutes ago', () => {
    const now = 1000000
    const features = { lastUpdatedAt: now - 15 * 60 * 1000 } // 15 minutes ago
    const wrapper = mountNode(features, now)
    expect(wrapper.text()).toContain('Updated: 15m ago')
  })

  it('shows hours ago when updated between 1 and 23 hours ago (exact hours)', () => {
    const now = 1000000
    const features = { lastUpdatedAt: now - 3 * 3600000 } // 3 hours ago
    const wrapper = mountNode(features, now)
    expect(wrapper.text()).toContain('Updated: 3h ago')
  })

  it('shows hours and minutes ago when updated with remaining minutes', () => {
    const now = 10000000
    const features = { lastUpdatedAt: now - 83 * 60 * 1000 } // 1h 23m ago
    const wrapper = mountNode(features, now)
    expect(wrapper.text()).toContain('Updated: 1h 23m ago')
  })

  it('shows days ago when updated 24+ hours ago', () => {
    const now = 10000000
    const features = { lastUpdatedAt: now - 2 * 24 * 3600000 } // 2 days ago
    const wrapper = mountNode(features, now)
    expect(wrapper.text()).toContain('Updated: 2d ago')
  })

  it('shows green text when updated less than 1 hour ago', () => {
    const now = 1000000
    const features = { lastUpdatedAt: now - 30 * 60 * 1000 } // 30 minutes ago
    const wrapper = mountNode(features, now)
    const span = wrapper.find('span.text-green-400')
    expect(span.exists()).toBe(true)
    expect(span.text()).toContain('Updated:')
  })

  it('shows orange text when updated between 2 and 3 hours ago', () => {
    const now = 1000000
    const features = { lastUpdatedAt: now - 150 * 60 * 1000 } // 150 minutes ago
    const wrapper = mountNode(features, now)
    const span = wrapper.find('span.text-orange-400')
    expect(span.exists()).toBe(true)
    expect(span.text()).toContain('Updated:')
  })

  it('shows red text when updated more than 3 hours ago', () => {
    const now = 1000000
    const features = { lastUpdatedAt: now - 4 * 3600000 } // 4 hours ago
    const wrapper = mountNode(features, now)
    const span = wrapper.find('span.text-red-400')
    expect(span.exists()).toBe(true)
    expect(span.text()).toContain('Updated:')
  })

  it('shows green text at exactly 1 hour and 59 minutes (boundary)', () => {
    const now = 1000000
    const features = { lastUpdatedAt: now - 119 * 60 * 1000 }
    const wrapper = mountNode(features, now)
    expect(wrapper.find('span.text-green-400').exists()).toBe(true)
  })

  it('shows orange text at exactly 2 hours (boundary)', () => {
    const now = 10000000
    const features = { lastUpdatedAt: now - 2 * 3600000 } // exactly 2 hours
    const wrapper = mountNode(features, now)
    expect(wrapper.find('span.text-orange-400').exists()).toBe(true)
  })

  it('shows red text at exactly 3 hours (boundary)', () => {
    const now = 10000000
    const features = { lastUpdatedAt: now - 3 * 3600000 } // exactly 3 hours
    const wrapper = mountNode(features, now)
    expect(wrapper.find('span.text-red-400').exists()).toBe(true)
  })
})
