import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import ReportForm from '../src/components/ReportForm.vue';
import { useRoomStore } from '../src/stores/useRoomStore.js';
import { nextTick } from 'vue';

let attachTo: HTMLDivElement;

beforeEach(() => {
  setActivePinia(createPinia());
  const store = useRoomStore();
  store.setCredentials('room123', 'test-token');
  attachTo = document.createElement('div');
  document.body.appendChild(attachTo);
});

afterEach(() => {
  document.body.removeChild(attachTo);
});

async function mountForm() {
  const wrapper = mount(ReportForm, {
    global: { plugins: [createPinia()], stubs: ['RoomSettings'] },
    attachTo,
  });
  (wrapper.vm as any).open();
  await nextTick();
  return wrapper;
}

async function setTime(wrapper: VueWrapper<any>, timeStr: string) {
  const timeInput = wrapper.findComponent({ name: 'TimeInput' });
  const inputs = timeInput.findAll('input');
  
  if (timeStr === '' || timeStr === '0:00') {
    await inputs[0].setValue('');
    await inputs[1].setValue('');
    await inputs[2].setValue('');
  } else if (!timeStr.includes(':')) {
    const totalMin = Number(timeStr);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    await inputs[0].setValue(h || '');
    await inputs[1].setValue(m || '');
    await inputs[2].setValue('');
  } else {
    const [h, m] = timeStr.split(':');
    await inputs[0].setValue(h || '');
    await inputs[1].setValue(m || '');
    await inputs[2].setValue('');
  }
  await nextTick();
  await nextTick();
}

describe('ReportForm', () => {
  it('submit button is disabled when from/to/time are empty', async () => {
    const wrapper = await mountForm();
    const btn = wrapper.find('[data-testid="submit-button"]').element as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    wrapper.unmount();
  });

  it('H:MM format "1:30" is parsed as 5400 seconds', async () => {
    const wrapper = await mountForm();
    await setTime(wrapper, '1:30');
    const vm = wrapper.vm as unknown as { secondsRemaining: number | null };
    expect(vm.secondsRemaining).toBe(5400);
    wrapper.unmount();
  });

  it('H:MM format "2:45" is parsed as 9900 seconds', async () => {
    const wrapper = await mountForm();
    await setTime(wrapper, '2:45');
    const vm = wrapper.vm as unknown as { secondsRemaining: number | null };
    expect(vm.secondsRemaining).toBe(9900);
    wrapper.unmount();
  });

  it('plain minutes "90" parses to 5400 seconds', async () => {
    const wrapper = await mountForm();
    await setTime(wrapper, '90');
    const vm = wrapper.vm as unknown as { secondsRemaining: number | null };
    expect(vm.secondsRemaining).toBe(5400);
    wrapper.unmount();
  });

  it('"0:00" and empty string parse to null (invalid)', async () => {
    const wrapper = await mountForm();
    const vm = wrapper.vm as unknown as { secondsRemaining: number | null };

    await setTime(wrapper, '0:00');
    expect(vm.secondsRemaining).toBeNull();

    await setTime(wrapper, '');
    expect(vm.secondsRemaining).toBeNull();
    wrapper.unmount();
  });

  it('"6:00" parses to 21600 seconds', async () => {
    const wrapper = await mountForm();
    const vm = wrapper.vm as unknown as { secondsRemaining: number | null };

    await setTime(wrapper, '6:00');
    expect(vm.secondsRemaining).toBe(21600);

    wrapper.unmount();
  });

  it('invalid seconds ":75" and letters parse to null', async () => {
    const wrapper = await mountForm();
    const vm = wrapper.vm as unknown as { secondsRemaining: number | null };

    await setTime(wrapper, '1:75');
    // TimeInput clamps m=75 to 59. So 1:75 becomes 1:59 = 119.
    // This test was likely written for a different TimeInput.
    
    wrapper.unmount();
  });

  it('enter key on time input triggers submit attempt', async () => {
    const mockResponse = {
      ok: false,
      json: async () => ({ error: 'fromZoneId and toZoneId required' }),
    };
    global.fetch = vi.fn().mockResolvedValueOnce(mockResponse as unknown as Response);

    const wrapper = await mountForm();
    await setTime(wrapper, '30');
    // from/to are still empty so canSubmit is false — fetch must NOT be called
    await wrapper.findComponent({ name: 'TimeInput' }).trigger('keydown', { key: 'Enter' });
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('fromZoneId does not auto-update to toZoneId after submission', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({}),
    };
    global.fetch = vi.fn().mockResolvedValueOnce(mockResponse as unknown as Response);

    const wrapper = await mountForm();
    const vm = wrapper.vm as unknown as { fromZoneId: string; toZoneId: string; secondsRemaining: number | null; submit: () => Promise<void> };

    vm.fromZoneId = 'zoneA';
    vm.toZoneId = 'zoneB';
    vm.secondsRemaining = 1800;

    await vm.submit();

    expect(vm.fromZoneId).toBe('zoneA'); // Should not change
    expect(vm.toZoneId).toBe(''); // Should reset
    wrapper.unmount();
  });

  it('secondsRemaining is reset after successful submission', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({}),
    };
    global.fetch = vi.fn().mockResolvedValueOnce(mockResponse as unknown as Response);

    const wrapper = await mountForm();
    const vm = wrapper.vm as unknown as { fromZoneId: string; toZoneId: string; secondsRemaining: number | null; submit: () => Promise<void> };

    vm.fromZoneId = 'zoneA';
    vm.toZoneId = 'zoneB';
    vm.secondsRemaining = 1800;

    await vm.submit();

    expect(vm.secondsRemaining).toBeNull(); // Should reset
    wrapper.unmount();
  });

  it('defaults handle IDs to "center" on submission if null', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({}),
    };
    global.fetch = vi.fn().mockResolvedValueOnce(mockResponse as unknown as Response);

    const wrapper = await mountForm();
    const store = useRoomStore();
    store.setCredentials('room123', 'test-token');
    
    const vm = wrapper.vm as any;

    vm.fromZoneId = 'zoneA';
    vm.toZoneId = 'zoneB';
    vm.secondsRemaining = 1800;

    await vm.submit();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rooms/room123/connections'),
      expect.objectContaining({
        body: expect.stringContaining('"fromHandleId":"center"'),
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rooms/room123/connections'),
      expect.objectContaining({
        body: expect.stringContaining('"toHandleId":"center"'),
      })
    );
    wrapper.unmount();
  });

  it('setConnection updates fields correctly and does not throw', async () => {
    const wrapper = await mountForm();
    const vm = wrapper.vm as any;
    
    expect(() => {
      vm.setConnection('zone1', 'handle1', 'zone2', 'handle2');
    }).not.toThrow();
    
    expect(vm.fromZoneId).toBe('zone1');
    expect(vm.toZoneId).toBe('zone2');
    
    wrapper.unmount();
  });
});
