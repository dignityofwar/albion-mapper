import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import RoomSettings from '../src/components/RoomSettings.vue';

let attachTo: HTMLDivElement;

beforeEach(() => {
  setActivePinia(createPinia());
  attachTo = document.createElement('div');
  document.body.appendChild(attachTo);
});

afterEach(() => {
  document.body.removeChild(attachTo);
});

describe('RoomSettings', () => {
  it('closes when clicking outside', async () => {
    const wrapper = mount(RoomSettings, { attachTo });
    
    // Find the gear icon
    const cog = wrapper.find('[data-testid="settings-cog"]');
    await cog.trigger('click');
    
    // Check if popup is open
    expect(wrapper.find('[data-testid="settings-popup"]').exists()).toBe(true);

    // Click outside
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Check if closed
    expect(wrapper.find('[data-testid="settings-popup"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('does not close when clicking inside', async () => {
    const wrapper = mount(RoomSettings, { attachTo });
    
    // Find the gear icon
    const cog = wrapper.find('[data-testid="settings-cog"]');
    await cog.trigger('click');
    
    // Check if popup is open
    expect(wrapper.find('[data-testid="settings-popup"]').exists()).toBe(true);

    // Click inside (on the reset button)
    const resetBtn = wrapper.find('[data-testid="settings-reset"]');
    await resetBtn.trigger('click');
    
    // Check if still open
    expect(wrapper.find('[data-testid="settings-popup"]').exists()).toBe(true);

    wrapper.unmount();
  });
});
