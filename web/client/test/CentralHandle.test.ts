import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import ZoneNode from '../src/components/flow/ZoneNode.vue'
import { createTestingPinia } from '@pinia/testing'
import { ref } from 'vue'

describe('ZoneNode Central Handle', () => {
  it('renders a central handle for standard roads nodes', () => {
    const wrapper = mount(ZoneNode as any, {
      props: {
        id: 'test-node',
        type: 'zone',
        data: {
          type: 'roads',
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
          Handle: true, // Stub Handle to avoid vue-flow errors
          ZoneHeader: true,
          ZoneCoresAndReds: true,
          ZoneReds: true,
          ZoneFeatures: true,
          ZoneEditorTray: true,
          TooltipProvider: true,
        }
      }
    })

    // Should render a handle for the central one
    const handles = wrapper.findAllComponents({ name: 'Handle' })
    expect(handles.length).toBe(1)
  })
})
