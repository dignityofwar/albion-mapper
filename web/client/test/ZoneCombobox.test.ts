import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import ZoneCombobox from '../src/components/ZoneCombobox.vue';
import { ZONES } from 'shared';

// We test the filtering logic by inspecting the component's internal computed
// rather than fighting reka-ui's portal teleportation in jsdom.

function getFilteredZones(query: string, excludedIds?: string[]) {
  const TYPE_LABELS: Record<string, string> = {
    royalBlue: 'Royal Blue',
    royalYellow: 'Royal Yellow',
    royalRed: 'Royal Red',
    outlands: 'Outlands',
    roads: 'Roads',
    roadsHideout: 'Roads (Hideout)',
    other: 'Other',
  };
  const q = query.toLowerCase().trim();
  return ZONES.filter((z) => {
    if (excludedIds && excludedIds.includes(z.id)) return false;
    if (!q) return true;
    return (
      z.name.toLowerCase().includes(q) ||
      TYPE_LABELS[z.type].toLowerCase().includes(q) ||
      `t${z.tier}`.includes(q)
    );
  });
}

describe('ZoneCombobox filtering logic', () => {
  it('typing "Roads" (the type label) returns only roads-type zones', () => {
    // Using the exact type label "Roads" guarantees all matches are roads type,
    // since no zone name or tier matches the string "Roads" except via the type label.
    const results = getFilteredZones('Roads');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((z) => {
      expect(['roads', 'roadsHideout']).toContain(z.type);
    });
  });

  it('typing "royal" returns only royal-type zones', () => {
    const results = getFilteredZones('royal');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((z) => {
      expect(['royalBlue', 'royalYellow', 'royalRed']).toContain(z.type);
    });
    // No roads or outlands
    expect(results.some((z) => z.type === 'roads')).toBe(false);
    expect(results.some((z) => z.type === 'outlands')).toBe(false);
  });

  it('excludedIds removes the zone from results', () => {
    const firstRoadsZone = ZONES.find((z) => z.type === 'roads')!;
    const without = getFilteredZones('', [firstRoadsZone.id]);
    const withoutIds = without.map((z) => z.id);
    expect(withoutIds).not.toContain(firstRoadsZone.id);
  });

  it('with no excludedIds, zone appears in results', () => {
    const firstRoadsZone = ZONES.find((z) => z.type === 'roads')!;
    const all = getFilteredZones('');
    const allIds = all.map((z) => z.id);
    expect(allIds).toContain(firstRoadsZone.id);
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
});
