import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import RoomSummaryToolbar from '../src/components/flow/zone/RoomSummaryToolbar.vue';
import { nextTick } from 'vue';

describe('RoomSummaryToolbar', () => {
  const defaultProps = {
    cores: [] as any[],
    crystals: [] as any[],
    dungeons: [] as any[],
    chests: [] as any[],
    alwaysExpanded: false,
  };

  function mountToolbar(props: Partial<typeof defaultProps> = {}) {
    return mount(RoomSummaryToolbar, {
      props: { ...defaultProps, ...props },
      global: { plugins: [createTestingPinia()] }
    });
  }

  it('is closed by default if there are no cores', () => {
    const wrapper = mountToolbar(defaultProps);
    // Check that no button has the active class
    const buttons = wrapper.findAll('button');
    buttons.forEach(button => {
      // The toggle button is also a button
      if (button.text() === '◀' || button.text() === '▶') return;
      expect(button.classes()).not.toContain('bg-indigo-600/20');
    });
  });

  it('is open to cores by default if there are cores', () => {
    const wrapper = mountToolbar({
      ...defaultProps,
      cores: [{ zoneId: '1', zoneName: 'Zone 1', expiresAt: Date.now() + 10000, coreType: 'green' }],
    });
    const coresButton = wrapper.find('button[title="Active Cores"]');
    expect(coresButton.classes()).toContain('bg-indigo-600/20');
  });

  it('automatically opens when first core is added', async () => {
    const wrapper = mountToolbar(defaultProps);
    
    expect(wrapper.find('button[title="Active Cores"]').classes()).not.toContain('bg-indigo-600/20');

    await wrapper.setProps({
      cores: [{ zoneId: '1', zoneName: 'Zone 1', expiresAt: Date.now() + 10000, coreType: 'green' }],
    });

    expect(wrapper.find('button[title="Active Cores"]').classes()).toContain('bg-indigo-600/20');
  });

  it('closes automatically when last core expires/removed', async () => {
    const wrapper = mountToolbar({
      ...defaultProps,
      cores: [{ zoneId: '1', zoneName: 'Zone 1', expiresAt: Date.now() + 10000, coreType: 'green' }],
    });
    
    expect(wrapper.find('button[title="Active Cores"]').classes()).toContain('bg-indigo-600/20');

    await wrapper.setProps({ cores: [] });

    expect(wrapper.find('button[title="Active Cores"]').classes()).not.toContain('bg-indigo-600/20');
  });

  it('does not automatically open if user manually closed it', async () => {
    const wrapper = mountToolbar({
      ...defaultProps,
      cores: [{ zoneId: '1', zoneName: 'Zone 1', expiresAt: Date.now() + 10000, coreType: 'green' }],
    });
    
    const coresButton = wrapper.find('button[title="Active Cores"]');
    expect(coresButton.classes()).toContain('bg-indigo-600/20');

    // Manually close
    await coresButton.trigger('click');
    expect(coresButton.classes()).not.toContain('bg-indigo-600/20');

    // Remove cores
    await wrapper.setProps({ cores: [] });
    
    // Add a core again
    await wrapper.setProps({
      cores: [{ zoneId: '2', zoneName: 'Zone 2', expiresAt: Date.now() + 10000, coreType: 'blue' }],
    });

    // Should NOT be open
    expect(wrapper.find('button[title="Active Cores"]').classes()).not.toContain('bg-indigo-600/20');
  });

  it('resets manual close if user manually opens it', async () => {
    const wrapper = mountToolbar({
      ...defaultProps,
      cores: [{ zoneId: '1', zoneName: 'Zone 1', expiresAt: Date.now() + 10000, coreType: 'green' }],
    });
    
    const coresButton = wrapper.find('button[title="Active Cores"]');
    
    // Manually close
    await coresButton.trigger('click');
    
    // Manually open
    await coresButton.trigger('click');
    expect(coresButton.classes()).toContain('bg-indigo-600/20');

    // Remove cores
    await wrapper.setProps({ cores: [] });
    expect(coresButton.classes()).not.toContain('bg-indigo-600/20');
    
    // Add a core again
    await wrapper.setProps({
      cores: [{ zoneId: '2', zoneName: 'Zone 2', expiresAt: Date.now() + 10000, coreType: 'blue' }],
    });

    // Should be open again because manual open reset the manual close flag
    expect(wrapper.find('button[title="Active Cores"]').classes()).toContain('bg-indigo-600/20');
  });

  it('disables buttons when there are no items', () => {
    const wrapper = mountToolbar({
      cores: [],
      crystals: [{ zoneId: '1', zoneName: 'Zone 1' }],
      dungeons: [],
      chests: [],
    });

    const coresButton = wrapper.find('button[title="Active Cores"]');
    const crystalsButton = wrapper.find('button[title="Crystals"]');
    const dungeonsButton = wrapper.find('button[title="Dungeons"]');
    const chestsButton = wrapper.find('button[title="Chests"]');

    expect((coresButton.element as HTMLButtonElement).disabled).toBe(true);
    expect((crystalsButton.element as HTMLButtonElement).disabled).toBe(false);
    expect((dungeonsButton.element as HTMLButtonElement).disabled).toBe(true);
    expect((chestsButton.element as HTMLButtonElement).disabled).toBe(true);
  });

  it('applies disabled classes to disabled buttons', () => {
    const wrapper = mountToolbar(defaultProps);

    const coresButton = wrapper.find('button[title="Active Cores"]');
    expect(coresButton.classes()).toContain('disabled:opacity-40');
    expect(coresButton.classes()).toContain('disabled:cursor-not-allowed');
  });

  it('hides the toggle button when alwaysExpanded is true', () => {
    const wrapper = mountToolbar({
      ...defaultProps,
      alwaysExpanded: true,
    });

    const toggleButton = wrapper.find('button.absolute.-left-3.top-2');
    expect(toggleButton.exists()).toBe(false);
  });
});
