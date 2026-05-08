import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import NonRoadsNode from '../src/components/flow/NonRoadsNode.vue'
import { createTestingPinia } from '@pinia/testing'
import { ref } from 'vue'

describe('NonRoadsNode Styling', () => {
  const mountNode = (data: any = {}) => {
    return mount(NonRoadsNode as any, {
      props: {
        id: 'test-node',
        type: 'non-roads',
        data: {
          type: 'royalBlue',
          isHome: false,
          tier: 5,
          zoneName: 'Test Zone',
          ...data
        },
        selected: false,
        dragging: false,
        resizing: false,
        connectable: true,
        zIndex: 0,
        position: { x: 0, y: 0 },
        dimensions: { width: 150, height: 150 },
        events: {} as any,
      },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: {
          Handle: true,
          ZoneHeader: true,
        }
      }
    })
  }

  it('applies correct border color for royalBlue', () => {
    const wrapper = mountNode({ type: 'royalBlue' })
    const border = wrapper.find('.diamond-shape.z-\\[5\\]')
    expect(border.classes()).toContain('bg-blue-500')
  })

  it('applies correct border color for royalYellow', () => {
    const wrapper = mountNode({ type: 'royalYellow' })
    const border = wrapper.find('.diamond-shape.z-\\[5\\]')
    expect(border.classes()).toContain('bg-yellow-500')
  })

  it('applies correct border color for royalRed', () => {
    const wrapper = mountNode({ type: 'royalRed' })
    const border = wrapper.find('.diamond-shape.z-\\[5\\]')
    expect(border.classes()).toContain('bg-red-500')
  })

  it('applies correct border color for outlands', () => {
    const wrapper = mountNode({ type: 'outlands' })
    const border = wrapper.find('.diamond-shape.z-\\[5\\]')
    expect(border.classes()).toContain('bg-[#1f1f1f]')
  })

  it('applies red-glow and red border when hasReds is true', () => {
    const wrapper = mountNode({ 
      features: { reds: 1 }
    })
    const container = wrapper.find('.non-roads-node .w-full.h-full.relative')
    expect(container.classes()).toContain('red-glow')
    
    const border = wrapper.find('.diamond-shape.z-\\[5\\]')
    expect(border.classes()).toContain('bg-red-500')

    const inner = wrapper.find('.diamond-shape.z-\\[6\\]')
    expect(inner.classes()).toContain('bg-red-950')
  })

  it('applies home-glow when isHome is true', () => {
    const wrapper = mountNode({ isHome: true })
    const container = wrapper.find('.non-roads-node .w-full.h-full.relative')
    expect(container.classes()).toContain('home-glow')
  })

  it('applies goto-glow-animation when highlighted is true', () => {
    const wrapper = mountNode({ highlighted: true })
    const container = wrapper.find('.non-roads-node .w-full.h-full.relative')
    expect(container.classes()).toContain('goto-glow-animation')
  })
})

describe('NonRoadsNode ping', () => {
  it('triggers ping animation when lastPing matches nodeId', async () => {
    const { setActivePinia, createPinia } = await import('pinia')
    const { useRoomStore } = await import('../src/stores/useRoomStore')
    setActivePinia(createPinia())
    const store = useRoomStore()

    const wrapper = mount(NonRoadsNode as any, {
      props: {
        id: 'dusklight-fen',
        type: 'non-roads',
        data: {
          type: 'outlands',
          isHome: false,
          tier: 5,
          zoneName: 'Dusklight Fen',
        },
        selected: false,
        dragging: false,
        resizing: false,
        connectable: true,
        zIndex: 0,
        position: { x: 0, y: 0 },
        dimensions: { width: 150, height: 150 },
        events: {} as any,
      },
      global: {
        stubs: { Handle: true, ZoneHeader: true },
      }
    })

    // Before ping: no ping-animation class
    expect(wrapper.find('.ping-animation').exists()).toBe(false)

    // Simulate receiving a ping message for this node
    store.lastPing = { zoneName: 'Dusklight Fen', nodeId: 'dusklight-fen' }
    await wrapper.vm.$nextTick()
    await new Promise(resolve => requestAnimationFrame(resolve))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.ping-animation').exists()).toBe(true)
  })

  it('does not trigger ping animation when lastPing is for a different node', async () => {
    const { setActivePinia, createPinia } = await import('pinia')
    const { useRoomStore } = await import('../src/stores/useRoomStore')
    setActivePinia(createPinia())
    const store = useRoomStore()

    const wrapper = mount(NonRoadsNode as any, {
      props: {
        id: 'dusklight-fen',
        type: 'non-roads',
        data: {
          type: 'outlands',
          isHome: false,
          tier: 5,
          zoneName: 'Dusklight Fen',
        },
        selected: false,
        dragging: false,
        resizing: false,
        connectable: true,
        zIndex: 0,
        position: { x: 0, y: 0 },
        dimensions: { width: 150, height: 150 },
        events: {} as any,
      },
      global: {
        stubs: { Handle: true, ZoneHeader: true },
      }
    })

    store.lastPing = { zoneName: 'Other Zone', nodeId: 'other-zone' }
    await wrapper.vm.$nextTick()
    await new Promise(resolve => requestAnimationFrame(resolve))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.ping-animation').exists()).toBe(false)
  })
})

describe('NonRoadsNode proximityTo', () => {
  it('renders "Arthur\'s Rest" tag when proximityTo is set', async () => {
    const wrapper = mount(NonRoadsNode as any, {
      props: {
        id: 'battlebrae-peaks',
        type: 'non-roads',
        data: {
          type: 'outlands',
          isHome: false,
          tier: 5,
          zoneName: 'Battlebrae Peaks',
          proximityTo: "Arthur's Rest"
        },
        selected: false,
        dragging: false,
        resizing: false,
        connectable: true,
        zIndex: 0,
        position: { x: 0, y: 0 },
        dimensions: { width: 150, height: 150 },
        events: {} as any,
      },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: { Handle: true }
      }
    })

    await new Promise(resolve => setTimeout(resolve, 50))
    expect(wrapper.text()).toContain("Arthur's Rest")
  })
})
