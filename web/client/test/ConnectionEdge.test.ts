import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ConnectionEdge from '../src/components/flow/ConnectionEdge.vue';
import { nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useRoomStore } from '../src/stores/useRoomStore';

const mockSetCenter = vi.fn();

vi.mock('@vue-flow/core', () => ({
  useVueFlow: () => ({
    setCenter: mockSetCenter,
  }),
  BaseEdge: { 
    template: '<div class="base-edge" @click="$emit(\'click\', $event)"></div>',
    emits: ['click']
  },
  EdgeLabelRenderer: { template: '<div class="edge-label-renderer"><slot /></div>' },
  getBezierPath: () => [ 'M0,0C25,0,75,100,100,100', 50, 50 ],
  getStraightPath: () => [ 'M0,0L100,100', 50, 50 ],
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  }
}));

// Mock formatCountdown to avoid dependency issues
vi.mock('../src/utils/formatters.js', () => ({
  formatCountdown: (ms: number) => `countdown-${ms}`,
}));

describe('ConnectionEdge', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.stubGlobal('innerWidth', 1000);
  });

  it('calls setCenter on mobile when popover is shown', async () => {
    vi.stubGlobal('innerWidth', 375); // Mobile width

    const wrapper = mount(ConnectionEdge, {
      props: {
        id: 'e1',
        sourceX: 0,
        sourceY: 0,
        targetX: 100,
        targetY: 100,
        sourcePosition: 'right' as any,
        targetPosition: 'left' as any,
        data: {
          connection: {
            id: 'c1',
            roomId: 'r1',
            fromZoneId: 'z1',
            toZoneId: 'z2',
            reportedAt: new Date().toISOString(),
            expiresAt: new Date().toISOString(),
          },
          now: 1000,
          hasChildren: false,
          onDelete: vi.fn(),
          onDeleteRecursive: vi.fn(),
          onUpdate: vi.fn(),
        },
      } as any,
      global: {
        provide: {
          openPopoverId: ref(null),
        },
        stubs: {
          TimeInput: true
        },
      },
    });

    // Initially popover is hidden
    expect(wrapper.vm.showPopover).toBe(false);

    // Click to show popover
    await wrapper.find('.base-edge').trigger('click');
    expect(wrapper.vm.showPopover).toBe(true);

    await nextTick();
    await nextTick(); // watch -> nextTick

    // labelX=50, labelY=50 -> setCenter(50, 50 + 50) = (50, 100)
    expect(mockSetCenter).toHaveBeenCalledWith(50, 150, { duration: 600, zoom: 1.4 });
  });

  it('does not call setCenter on desktop when popover is shown', async () => {
    vi.stubGlobal('innerWidth', 1024); // Desktop width

    const wrapper = mount(ConnectionEdge, {
      props: {
        id: 'e1',
        sourceX: 0,
        sourceY: 0,
        targetX: 100,
        targetY: 100,
        sourcePosition: 'right' as any,
        targetPosition: 'left' as any,
        data: {
          connection: {
            id: 'c1',
            roomId: 'r1',
            fromZoneId: 'z1',
            toZoneId: 'z2',
            reportedAt: new Date().toISOString(),
            expiresAt: new Date().toISOString(),
          },
          now: 1000,
          hasChildren: false,
          onDelete: vi.fn(),
          onDeleteRecursive: vi.fn(),
          onUpdate: vi.fn(),
        },
      } as any,
      global: {
        provide: {
          openPopoverId: ref(null),
        },
        stubs: {
          TimeInput: true
        },
      },
    });

    await wrapper.find('.base-edge').trigger('click');
    await nextTick();
    await nextTick();

    expect(mockSetCenter).not.toHaveBeenCalled();
  });

  it('displays "Expired" when the connection is expired', async () => {
    const wrapper = mount(ConnectionEdge, {
      props: {
        id: 'e1',
        sourceX: 0,
        sourceY: 0,
        targetX: 100,
        targetY: 100,
        sourcePosition: 'right' as any,
        targetPosition: 'left' as any,
        data: {
          connection: {
            id: 'c1',
            roomId: 'r1',
            fromZoneId: 'z1',
            toZoneId: 'z2',
            reportedAt: new Date().toISOString(),
            expiresAt: new Date().toISOString(),
            isExpired: true,
          },
          now: 1000,
          hasChildren: false,
          onDelete: vi.fn(),
          onDeleteRecursive: vi.fn(),
          onUpdate: vi.fn(),
        },
      } as any,
      global: {
        provide: {
          openPopoverId: ref(null),
        },
        stubs: {
          TimeInput: true
        },
      },
    });

    // Check if the timer displays "Expired"
    const timer = wrapper.find('[data-trigger="true"]');
    expect(timer.text()).toBe('Expired');
  });

  it('displays "Isolated" when an ancestor connection is expired', async () => {
    // Setup pinia with roomStore connections
    const store = useRoomStore();
    store.connections = [
        {
            id: 'c-ancestor',
            roomId: 'r1',
            fromZoneId: 'z0',
            toZoneId: 'z1',
            reportedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
            isExpired: true,
        },
        {
            id: 'c-child',
            roomId: 'r1',
            fromZoneId: 'z1',
            toZoneId: 'z2',
            reportedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 10000).toISOString(), // Not expired
        }
    ];

    const wrapper = mount(ConnectionEdge, {
      props: {
        id: 'e-child',
        sourceX: 0,
        sourceY: 0,
        targetX: 100,
        targetY: 100,
        sourcePosition: 'right' as any,
        targetPosition: 'left' as any,
        data: {
          connection: store.connections[1],
          now: Date.now(),
          hasChildren: false,
          onDelete: vi.fn(),
          onDeleteRecursive: vi.fn(),
          onUpdate: vi.fn(),
        },
      } as any,
      global: {
        provide: {
          openPopoverId: ref(null),
        },
        stubs: {
          TimeInput: true
        },
      },
    });

    // Check if the timer displays "Isolated"
    const timer = wrapper.find('[data-trigger="true"]');
    expect(timer.text()).toBe('Isolated');
  });

  it('displays "Isolated" when connection is both expired and downstream of an expired ancestor', async () => {
    // Setup pinia with roomStore connections
    const store = useRoomStore();
    store.connections = [
        {
            id: 'c-ancestor',
            roomId: 'r1',
            fromZoneId: 'z0',
            toZoneId: 'z1',
            reportedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
            isExpired: true,
        },
        {
            id: 'c-child',
            roomId: 'r1',
            fromZoneId: 'z1',
            toZoneId: 'z2',
            reportedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
            isExpired: true,
        }
    ];

    const wrapper = mount(ConnectionEdge, {
      props: {
        id: 'e-child',
        sourceX: 0,
        sourceY: 0,
        targetX: 100,
        targetY: 100,
        sourcePosition: 'right' as any,
        targetPosition: 'left' as any,
        data: {
          connection: store.connections[1],
          now: Date.now(),
          hasChildren: false,
          onDelete: vi.fn(),
          onDeleteRecursive: vi.fn(),
          onUpdate: vi.fn(),
        },
      } as any,
      global: {
        provide: {
          openPopoverId: ref(null),
        },
        stubs: {
          TimeInput: true
        },
      },
    });

    // Check if the timer displays "Isolated"
    const timer = wrapper.find('[data-trigger="true"]');
    expect(timer.text()).toBe('Isolated');
  });
});
