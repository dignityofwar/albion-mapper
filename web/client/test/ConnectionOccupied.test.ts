import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import ReportForm from '../src/components/ReportForm.vue';
import { useRoomStore } from '@/stores/useRoomStore';
import { nextTick } from 'vue';

describe('ReportForm - Connection Occupied', () => {
  let pinia: any;
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    const store = useRoomStore();
    store.setCredentials('room123', 'test-token');
    // Mock connections
    store.connections = [
      {
        id: 'conn1',
        fromZoneId: 'zoneA',
        fromHandleId: 'nw',
        toZoneId: 'zoneB',
        toHandleId: 'se',
        isExpired: false,
        secondsRemaining: 1000,
        createdAt: '2026-05-08T00:00:00Z',
      }
    ];
  });

  it('emits error when trying to connect to an already occupied portal', async () => {
    const wrapper = mount(ReportForm, {
      global: { plugins: [pinia], stubs: ['RoomSettings'] },
    });
    const vm = wrapper.vm as any;
    vm.open();
    await nextTick();

    // Set connection that attempts to use 'nw' of 'zoneA' which is already used in conn1
    vm.fromZoneId = 'zoneC';
    vm.fromHandleId = 'center';
    vm.toZoneId = 'zoneA';
    vm.toHandleId = 'nw';
    vm.secondsRemaining = 1000;

    // Trigger submission
    await vm.submitAndAddMore();

    // Check if error event was emitted
    expect(wrapper.emitted('error')).toBeTruthy();
    expect(wrapper.emitted('error')![0]).toEqual(['It is not possible to connect already connected portals.']);
  });

  it('allows multiple connections if they use the center handle', async () => {
    const wrapper = mount(ReportForm, {
      global: { plugins: [pinia], stubs: ['RoomSettings'] },
    });
    const vm = wrapper.vm as any;
    vm.open();
    await nextTick();

    // Mock existing connection with center
    const store = useRoomStore();
    store.connections = [
      {
        id: 'conn1',
        fromZoneId: 'zoneA',
        fromHandleId: 'center',
        toZoneId: 'zoneB',
        toHandleId: 'center',
        isExpired: false,
        secondsRemaining: 1000,
        createdAt: '2026-05-08T00:00:00Z',
      }
    ];

    // Try to add another connection using center
    vm.fromZoneId = 'zoneA';
    vm.fromHandleId = 'center';
    vm.toZoneId = 'zoneC';
    vm.toHandleId = 'center';
    vm.secondsRemaining = 1000;

    // Mock fetch for successful response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as any);

    // Trigger submission
    await vm.submitAndAddMore();

    // Check that NO error was emitted
    expect(wrapper.emitted('error')).toBeFalsy();
  });
});
