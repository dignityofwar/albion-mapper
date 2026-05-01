import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref } from 'vue';
import { useRoomStore } from '../src/stores/useRoomStore';
import ConnectionEdge from '../src/components/flow/ConnectionEdge.vue';

// Need to mock @vue-flow/core because it's hard to test fully
import { vi } from 'vitest';
vi.mock('@vue-flow/core', async () => {
  const actual = await vi.importActual<any>('@vue-flow/core');
  return {
    ...actual,
    BaseEdge: {
      name: 'BaseEdge',
      template: '<div class="base-edge" :animated="animated"></div>',
      props: ['animated', 'path', 'id', 'style']
    },
    EdgeLabelRenderer: {
      template: '<div><slot/></div>'
    },
    useVueFlow: () => ({
      setCenter: vi.fn(),
    })
  };
});

describe('ConnectionEdge', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('shows non-animated edge when restricted', async () => {
    const store = useRoomStore();
    const now = Date.now();
    
    // Parent expires in 2s
    const parentExpiresAt = new Date(now + 2000).toISOString();
    // Child expires in 10m
    const childExpiresAt = new Date(now + 600000).toISOString();
    
    store.applyMessage({
      type: 'sync',
      connections: [
        { id: 'parent', roomId: 'r1', fromZoneId: 'home', toZoneId: 'a', expiresAt: parentExpiresAt, reportedAt: new Date().toISOString() },
        { id: 'child', roomId: 'r1', fromZoneId: 'a', toZoneId: 'b', expiresAt: childExpiresAt, reportedAt: new Date().toISOString() }
      ],
      homeZoneId: 'home',
      nodePositions: [{ zoneId: 'home', x: 0, y: 0 }, { zoneId: 'a', x: 10, y: 10 }, { zoneId: 'b', x: 20, y: 20 }],
      lastUpdatedAt: new Date().toISOString()
    });

    // Advance time to 3s
    const currentTime = now + 3000;
    
    const wrapper = mount(ConnectionEdge, {
      props: {
        id: 'child',
        sourceX: 0,
        sourceY: 0,
        targetX: 10,
        targetY: 10,
        data: {
          connection: {
            id: 'child',
            roomId: 'r1',
            fromZoneId: 'a',
            toZoneId: 'b',
            expiresAt: childExpiresAt,
            reportedAt: new Date().toISOString(),
            isExpired: false
          },
          now: currentTime
        },
        sourceNode: {} as any,
        targetNode: {} as any,
        source: 'a',
        target: 'b',
        type: 'default',
        sourcePosition: 'top' as any,
        targetPosition: 'bottom' as any,
        markerStart: '',
        markerEnd: '',
        events: {} as any,
      },
      global: {
        provide: {
          openPopoverId: ref(null)
        }
      }
    });

    // The edge should be restricted (isolated)
    expect(store.isEdgeIsolated('child', currentTime)).toBe(true);

    // Check if the BaseEdge has animated=false
    // The BaseEdge is rendered in our mock
    const baseEdge = wrapper.findComponent({ name: 'BaseEdge' });
    
    // The `animated` prop is passed to BaseEdge.
    // In our mock, we passed `animated="animated"` in template, but props are `['animated', ...]`
    expect(baseEdge.props('animated')).toBe(false);

    // Verify that the <g> with animateMotion is NOT rendered
    const animateMotionGroup = wrapper.find('g.pointer-events-none');
    expect(animateMotionGroup.exists()).toBe(false);
  });
});
