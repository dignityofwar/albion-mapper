import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import ZoneNode from '../src/components/flow/ZoneNode.vue'
import { createTestingPinia } from '@pinia/testing'
import { ref, nextTick } from 'vue'

describe('Reds Timer Logic', () => {
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

  it('shows reds when timer is active', () => {
    const now = 1000000;
    const features = {
      reds: 5,
      redsTimer: now + 60000 // 1 minute from now
    }
    const wrapper = mountNode(features, now)
    const nodeDiv = wrapper.find('.min-w-\\[400px\\]')
    expect(nodeDiv.classes()).toContain('red-glow')
  })

  it('hides reds when timer is expired', () => {
    const now = 1000000;
    const features = {
      reds: 5,
      redsTimer: now - 1000 // Expired 1 second ago
    }
    const wrapper = mountNode(features, now)
    const nodeDiv = wrapper.find('.min-w-\\[400px\\]')
    expect(nodeDiv.classes()).not.toContain('red-glow')
  })

  it('shows correct tooltip with remaining time', () => {
    const now = 1000000;
    const features = {
      reds: 5,
      redsTimer: now + (15 * 60 * 1000) + (30 * 1000) // 15:30 remaining
    }
    const wrapper = mountNode(features, now)
    const zoneReds = wrapper.findComponent({ name: 'ZoneReds' })
    expect(zoneReds.exists()).toBe(true)
    expect((zoneReds.vm as any).tooltipText).toBe('Reds (expires in 15:30)')
  })

  it('sets 30 minute timer when reds are updated', async () => {
    const now = 1000000;
    const wrapper = mountNode({}, now)
    
    // In ZoneNode, updateReds is called when ZoneReds emits update:reds
    const zoneReds = wrapper.findComponent({ name: 'ZoneReds' })
    await zoneReds.setValue(5, 'reds') // This might not work as intended if it's not a form input
    
    // Let's call updateReds directly if possible or find the trigger
    // Actually, ZoneReds is a component, we can emit from it
    await zoneReds.vm.$emit('update:reds', 5)
    
    // Check if store.updateNodeFeatures was called with correct timer
    const store = (wrapper.vm as any).store
    expect(store.updateNodeFeatures).toHaveBeenCalledWith('test-node', expect.objectContaining({
      reds: 5,
      redsTimer: now + 30 * 60 * 1000
    }))
  })
})
