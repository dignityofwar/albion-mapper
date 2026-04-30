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
        dimensions: { width: 200, height: 200 },
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
    const container = wrapper.find('.min-w-\\[200px\\]')
    expect(container.classes()).toContain('red-glow')
    
    const border = wrapper.find('.diamond-shape.z-\\[5\\]')
    expect(border.classes()).toContain('bg-red-500')

    const inner = wrapper.find('.diamond-shape.z-\\[6\\]')
    expect(inner.classes()).toContain('bg-red-950')
  })

  it('applies home-glow when isHome is true', () => {
    const wrapper = mountNode({ isHome: true })
    const container = wrapper.find('.min-w-\\[200px\\]')
    expect(container.classes()).toContain('home-glow')
  })

  it('applies goto-glow when highlighted is true', () => {
    const wrapper = mountNode({ highlighted: true })
    const container = wrapper.find('.min-w-\\[200px\\]')
    expect(container.classes()).toContain('goto-glow')
  })
})
