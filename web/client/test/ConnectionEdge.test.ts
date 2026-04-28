import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ConnectionEdge from '../src/components/flow/ConnectionEdge.vue';
import { nextTick, ref } from 'vue';

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
  getStraightPath: () => [ 'M0,0L100,100', 50, 50 ],
}));

// Mock formatCountdown to avoid dependency issues
vi.mock('../src/utils/formatters.js', () => ({
  formatCountdown: (ms: number) => `countdown-${ms}`,
}));

describe('ConnectionEdge', () => {
  beforeEach(() => {
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
});
