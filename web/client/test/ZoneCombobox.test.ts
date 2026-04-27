import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { useRoomStore } from '../src/stores/useRoomStore.js';
import { ZONES } from 'shared';
import ZoneCombobox from '../src/components/ZoneCombobox.vue';

// We test the filtering logic by inspecting the component's internal computed
// rather than fighting reka-ui's portal teleportation in jsdom.

describe('ZoneCombobox filtering logic', () => {
  it('smartAlreadyAdded hides already-added zones when no query', () => {
    setActivePinia(createPinia());
    const store = useRoomStore();
    // Make sure we have some connections
    store.connections = [{
      id: '550e8400-e29b-41d4-a716-446655440000',
      roomId: 'room1',
      fromZoneId: '1',
      toZoneId: '2',
      expiresAt: new Date().toISOString(),
      reportedAt: new Date().toISOString(),
    }];

    const wrapper = mount(ZoneCombobox, {
      props: { modelValue: '', smartAlreadyAdded: true },
      global: { plugins: [createPinia()] },
    });
    
    // @ts-ignore
    const filteredZones = wrapper.vm.filteredZones;
    const mappedZoneIds = new Set(['1', '2']);
    
    // All mapped zones should be absent if !query
    filteredZones.forEach((z: any) => {
        expect(mappedZoneIds.has(z.id)).toBe(false);
    });
    wrapper.unmount();
  });

  it('smartAlreadyAdded sorts already-added zones to bottom when query', async () => {
    setActivePinia(createPinia());
    const store = useRoomStore();
    store.connections = [{
      id: '550e8400-e29b-41d4-a716-446655440000',
      roomId: 'room1',
      fromZoneId: '1',
      toZoneId: '2',
      expiresAt: new Date().toISOString(),
      reportedAt: new Date().toISOString(),
    }];

    const wrapper = mount(ZoneCombobox, {
      props: { modelValue: '', smartAlreadyAdded: true, alreadyAddedPlacement: 'bottom' },
      global: { plugins: [createPinia()] },
    });
    
    // Set query
    await wrapper.find('[data-testid="zone-combobox-input"]').setValue('a');

    // @ts-ignore
    const filteredZones = wrapper.vm.filteredZones;
    
    // Check if any mapped zone exists
    const mappedIds = new Set(['1', '2']);
    
    // For bottom placement, mapped zones should be at the end if they appear.
    // Let's verify the sorting
    const mappedZones = filteredZones.filter((z: any) => mappedIds.has(z.id));
    const unmappedZones = filteredZones.filter((z: any) => !mappedIds.has(z.id));
    
    // Verify mapped zones are at the end
    if (mappedZones.length > 0 && unmappedZones.length > 0) {
        const lastZone = filteredZones[filteredZones.length - 1];
        expect(mappedIds.has(lastZone.id)).toBe(true);
    }
    
    wrapper.unmount();
  });

  it('smartAlreadyAdded sorts already-added zones to top when query', async () => {
    setActivePinia(createPinia());
    const store = useRoomStore();
    store.connections = [{
      id: '550e8400-e29b-41d4-a716-446655440000',
      roomId: 'room1',
      fromZoneId: '1',
      toZoneId: '2',
      expiresAt: new Date().toISOString(),
      reportedAt: new Date().toISOString(),
    }];

    const wrapper = mount(ZoneCombobox, {
      props: { modelValue: '', smartAlreadyAdded: true, alreadyAddedPlacement: 'top' },
      global: { plugins: [createPinia()] },
    });
    
    // Set query
    await wrapper.find('[data-testid="zone-combobox-input"]').setValue('a');

    // @ts-ignore
    const filteredZones = wrapper.vm.filteredZones;
    
    // Check if any mapped zone exists
    const mappedIds = new Set(['1', '2']);
    
    // For top placement, mapped zones should be at the beginning.
    const mappedZones = filteredZones.filter((z: any) => mappedIds.has(z.id));
    
    if (mappedZones.length > 0) {
        const firstZone = filteredZones[0];
        expect(mappedIds.has(firstZone.id)).toBe(true);
    }
    
    wrapper.unmount();
  });

  it('smartAlreadyAdded sorts home zone to top', async () => {
    setActivePinia(createPinia());
    const store = useRoomStore();
    const homeZone = ZONES[0];
    store.homeZoneId = homeZone.id;

    const wrapper = mount(ZoneCombobox, {
      props: { modelValue: '', smartAlreadyAdded: true },
      global: { plugins: [createPinia()] },
    });
    
    // Set query
    // @ts-ignore
    wrapper.vm.query = homeZone.name;

    // @ts-ignore
    const filteredZones = wrapper.vm.filteredZones;
    
    expect(filteredZones[0]?.id).toBe(homeZone.id);
    
    wrapper.unmount();
  });

  it('onlyRoadsHideout filters zones to only roads hideouts', async () => {
    setActivePinia(createPinia());
    const wrapper = mount(ZoneCombobox, {
      props: { modelValue: '', onlyRoadsHideout: true },
      global: { plugins: [createPinia()] },
    });
    
    // No query set - should still show hideouts
    
    // @ts-ignore
    const filteredZones = wrapper.vm.filteredZones;
    
    expect(filteredZones.length).toBeGreaterThan(0);
    filteredZones.forEach((z: any) => {
        expect(z.isRoadsHome).toBe(true);
    });
    
    // Verify some non-hideout zones are NOT in the list
    const hasRoyal = filteredZones.some((z: any) => z.type.startsWith('royal'));
    expect(hasRoyal).toBe(false);

    wrapper.unmount();
  });
});

describe('ZoneCombobox component renders', () => {
  it('renders the input with the correct placeholder', () => {
    const wrapper = mount(ZoneCombobox, {
      props: { modelValue: '', placeholder: 'Search zones…' },
      global: { plugins: [createPinia()] },
    });
    const input = wrapper.find('[data-testid="zone-combobox-input"]');
    expect(input.exists()).toBe(true);
    expect((input.element as HTMLInputElement).placeholder).toBe('Search zones…');
    wrapper.unmount();
  });

  it('renders with icon when provided', () => {
    const wrapper = mount(ZoneCombobox, {
      props: { modelValue: '', icon: '🏠' },
      global: { plugins: [createPinia()] },
    });
    expect(wrapper.text()).toContain('🏠');
    wrapper.unmount();
  });

  it('applies disabled styles', () => {
    const wrapper = mount(ZoneCombobox, {
      props: { modelValue: '', disabled: true },
      global: { plugins: [createPinia()] },
    });
    const container = wrapper.find('.cursor-not-allowed');
    expect(container.exists()).toBe(true);
    
    const input = wrapper.find('[data-testid="zone-combobox-input"]');
    expect(input.classes()).toContain('cursor-not-allowed');
    wrapper.unmount();
  });
});
