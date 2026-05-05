import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import ZoneNode from '../src/components/flow/ZoneNode.vue'
import { createTestingPinia } from '@pinia/testing'
import { ref } from 'vue'

const baseProps = (data: object) => ({
  id: 'test-node',
  type: 'zone',
  data: {
    tier: 5,
    zoneName: 'Test Zone',
    ...data,
  },
  selected: false,
  dragging: false,
  resizing: false,
  connectable: true,
  zIndex: 0,
  position: { x: 0, y: 0 },
  dimensions: { width: 400, height: 400 },
  events: {} as any,
})

const globalOpts = {
  plugins: [createTestingPinia({ createSpy: vi.fn })],
  provide: {
    globalNow: ref(Date.now()),
  },
  stubs: {
    Handle: true,
    ZoneHeader: true,
    ZoneCoresAndReds: true,
    ZoneReds: true,
    ZoneFeatures: true,
    ZoneEditorTray: true,
    TooltipProvider: true,
  },
}

describe('Disabled Handles', () => {
  it('renders all enabled custom handles on a shaped zone', () => {
    const wrapper = mount(ZoneNode as any, {
      props: baseProps({
        type: 'roads',
        mapShape: 'c',
        customHandles: [
          { id: 'c-p1', left: '33.79%', top: '16.21%' },
          { id: 'c-p2', left: '7.62%', top: '42.38%' },
        ],
      }),
      global: globalOpts,
    })

    // 2 custom handles + 1 center handle
    const handles = wrapper.findAllComponents({ name: 'Handle' })
    expect(handles.length).toBe(3)
  })

  it('hides disabled custom handles on a shaped zone outside the editor', () => {
    const wrapper = mount(ZoneNode as any, {
      props: baseProps({
        type: 'roads',
        mapShape: 'c',
        customHandles: [
          { id: 'c-p1', left: '33.79%', top: '16.21%' },
          { id: 'c-p2', left: '7.62%', top: '42.38%', disabled: true },
          { id: 'c-p3', left: '16.99%', top: '66.99%', disabled: true },
        ],
      }),
      global: globalOpts,
    })

    // Only c-p1 (enabled) + center handle should render; c-p2 and c-p3 are disabled
    const handles = wrapper.findAllComponents({ name: 'Handle' })
    expect(handles.length).toBe(2)
  })

  it('hides all handles when all custom handles are disabled on a shaped zone', () => {
    const wrapper = mount(ZoneNode as any, {
      props: baseProps({
        type: 'roads',
        mapShape: 'c',
        customHandles: [
          { id: 'c-p1', left: '33.79%', top: '16.21%', disabled: true },
          { id: 'c-p2', left: '7.62%', top: '42.38%', disabled: true },
        ],
      }),
      global: globalOpts,
    })

    // Only center handle should remain
    const handles = wrapper.findAllComponents({ name: 'Handle' })
    expect(handles.length).toBe(1)
  })

  it('does not hide enabled handles on a hideout (deleted handles are simply absent)', () => {
    const wrapper = mount(ZoneNode as any, {
      props: baseProps({
        type: 'roadsHideout',
        // Only n and s remain; e and w were deleted (not present at all)
        customHandles: [
          { id: 'n', left: '50%', top: '0%' },
          { id: 's', left: '50%', top: '100%' },
        ],
      }),
      global: globalOpts,
    })

    // 2 remaining handles + 1 center handle
    const handles = wrapper.findAllComponents({ name: 'Handle' })
    expect(handles.length).toBe(3)
  })
})
