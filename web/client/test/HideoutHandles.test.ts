import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import ZoneNode from '../src/components/flow/ZoneNode.vue'
import { createTestingPinia } from '@pinia/testing'
import { ref } from 'vue'

describe('Hideout Handles', () => {
  it('renders handles for roadsHideout', () => {
    const wrapper = mount(ZoneNode as any, {
      props: {
        id: 'test-node',
        type: 'zone',
        data: {
          type: 'roadsHideout',
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
        }
      }
    })
    
    // Check if there are handles (assuming Handle component from vue-flow)
    const handles = wrapper.findAllComponents({ name: 'Handle' })
    expect(handles.length).toBe(5)
  })
})
