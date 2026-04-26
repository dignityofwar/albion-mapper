import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import ReportForm from '../src/components/ReportForm.vue';
import { useRoomStore } from '../src/stores/useRoomStore.js';

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

function mountForm() {
  return mount(ReportForm, {
    global: { plugins: [createPinia()] },
    attachTo,
  });
}

describe('ReportForm', () => {
  it('submit button is disabled when from/to/time are empty', () => {
    const wrapper = mountForm();
    const btn = wrapper.find('[data-testid="submit-button"]').element as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    wrapper.unmount();
  });

  it('H:MM format "1:30" is parsed as 90 minutes', async () => {
    const wrapper = mountForm();
    const input = wrapper.find('[data-testid="time-input"]');
    await input.setValue('1:30');
    const vm = wrapper.vm as unknown as { minutesRemaining: number | null };
    expect(vm.minutesRemaining).toBe(90);
    wrapper.unmount();
  });

  it('H:MM format "2:45" is parsed as 165 minutes', async () => {
    const wrapper = mountForm();
    const input = wrapper.find('[data-testid="time-input"]');
    await input.setValue('2:45');
    const vm = wrapper.vm as unknown as { minutesRemaining: number | null };
    expect(vm.minutesRemaining).toBe(165);
    wrapper.unmount();
  });

  it('plain minutes "90" parses to 90', async () => {
    const wrapper = mountForm();
    const input = wrapper.find('[data-testid="time-input"]');
    await input.setValue('90');
    const vm = wrapper.vm as unknown as { minutesRemaining: number | null };
    expect(vm.minutesRemaining).toBe(90);
    wrapper.unmount();
  });

  it('"0:00" and empty string parse to null (invalid)', async () => {
    const wrapper = mountForm();
    const input = wrapper.find('[data-testid="time-input"]');
    const vm = wrapper.vm as unknown as { minutesRemaining: number | null };

    await input.setValue('0:00');
    expect(vm.minutesRemaining).toBeNull();

    await input.setValue('');
    expect(vm.minutesRemaining).toBeNull();
    wrapper.unmount();
  });

  it('"6:00" parses to 360, "6:01" parses to null (exceeds max)', async () => {
    const wrapper = mountForm();
    const input = wrapper.find('[data-testid="time-input"]');
    const vm = wrapper.vm as unknown as { minutesRemaining: number | null };

    await input.setValue('6:00');
    expect(vm.minutesRemaining).toBe(360);

    await input.setValue('6:01');
    expect(vm.minutesRemaining).toBeNull();
    wrapper.unmount();
  });

  it('invalid seconds ":75" and letters parse to null', async () => {
    const wrapper = mountForm();
    const input = wrapper.find('[data-testid="time-input"]');
    const vm = wrapper.vm as unknown as { minutesRemaining: number | null };

    await input.setValue('1:75');
    expect(vm.minutesRemaining).toBeNull();

    await input.setValue('abc');
    expect(vm.minutesRemaining).toBeNull();
    wrapper.unmount();
  });

  it('enter key on time input triggers submit attempt', async () => {
    const mockResponse = {
      ok: false,
      json: async () => ({ error: 'fromZoneId and toZoneId required' }),
    };
    global.fetch = vi.fn().mockResolvedValueOnce(mockResponse as unknown as Response);

    const wrapper = mountForm();
    await wrapper.find('[data-testid="time-input"]').setValue('30');
    // from/to are still empty so canSubmit is false — fetch must NOT be called
    await wrapper.find('[data-testid="time-input"]').trigger('keydown', { key: 'Enter' });
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
