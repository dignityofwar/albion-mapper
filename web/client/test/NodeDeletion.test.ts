import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import NonRoadsNode from '../src/components/flow/NonRoadsNode.vue'
import ZoneNode from '../src/components/flow/ZoneNode.vue'
import { createTestingPinia } from '@pinia/testing'
import * as roomOperations from '@/utils/roomOperations'

// Mock the room operations
vi.mock('@/utils/roomOperations', () => ({
  deleteNode: vi.fn(),
  deleteConnection: vi.fn()
}))

describe('Node Deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('NonRoadsNode deletes node after connections', async () => {
    const wrapper = mount(NonRoadsNode as any, {
      props: {
        id: 'test-node',
        type: 'non-roads',
        data: {
          type: 'royalBlue',
          isHome: false,
          tier: 5,
          zoneName: 'Test Zone',
          features: {},
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
        plugins: [createTestingPinia({ 
          createSpy: vi.fn,
          initialState: {
            room: {
              connections: [{ id: 'conn1', toZoneId: 'test-node', isExpired: true, expiresAt: new Date(0).toISOString() }]
            }
          }
        })],
        provide: {
          showPingToast: vi.fn(),
          globalNow: ref(Date.now())
        },
        stubs: { Handle: true, ZoneHeader: true }
      }
    })

    // Simulate calling handleDelete directly
    await (wrapper.vm as any).handleDelete()
    
    expect(roomOperations.deleteConnection).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'conn1')
    expect(roomOperations.deleteNode).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'test-node')
  })
  
  it('ZoneNode deletes node after connections', async () => {
    const wrapper = mount(ZoneNode as any, {
      props: {
        id: 'test-node',
        type: 'zone',
        data: {
          zoneName: 'Test Zone',
          features: {},
          type: 'royalBlue',
          isHome: false,
          tier: 5,
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
        plugins: [createTestingPinia({ 
          createSpy: vi.fn,
          initialState: {
            room: {
              connections: [{ id: 'conn1', toZoneId: 'test-node', isExpired: true, expiresAt: new Date(0).toISOString() }]
            }
          }
        })],
        provide: {
          showToast: vi.fn(),
          showPingToast: vi.fn(),
          globalNow: ref(Date.now())
        },
        stubs: { Handle: true, ZoneHeader: true, ZoneCoresAndReds: true, ZoneReds: true, ZoneFeatures: true, ZoneMapFeaturesModal: true, ZoneHandleEditor: true, ZoneHandleEditorButton: true, TooltipProvider: true, TooltipRoot: true, TooltipTrigger: true, TooltipContent: true, TooltipPortal: true, TutorialTooltip: true }
      }
    })

    // Simulate calling handleDelete directly
    await (wrapper.vm as any).handleDelete()
    
    expect(roomOperations.deleteConnection).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'conn1')
    expect(roomOperations.deleteNode).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'test-node')
  })
})
