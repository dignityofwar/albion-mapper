import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ZoneHandleEditor from '../src/components/flow/zone/ZoneHandleEditor.vue';
import { getDefaultHandles } from 'shared';

describe('ZoneHandleEditor', () => {
  const initialHandles = [
    { id: '1', left: '50.00%', top: '0.00%', disabled: false },
    { id: '2', left: '100.00%', top: '50.00%', disabled: true },
  ];

  it('renders correctly', () => {
    const wrapper = mount(ZoneHandleEditor, {
      props: {
        zoneName: 'Test Zone',
        initialHandles,
        isToggleMode: true
      }
    });

    expect(wrapper.text()).toContain('Test Zone Handles');
    expect(wrapper.findAll('.bg-blue-500')).toHaveLength(1); // Active handle
    // The background also has bg-gray-600, so we check for handles specifically
    expect(wrapper.findAll('div.bg-gray-600.transition-all')).toHaveLength(1); // Disabled handle
  });

  it('toggles handle disabled state in toggle mode', async () => {
    const wrapper = mount(ZoneHandleEditor, {
      props: {
        zoneName: 'Test Zone',
        initialHandles,
        isToggleMode: true
      }
    });

    const activeHandle = wrapper.find('.bg-blue-500');
    await activeHandle.trigger('click');

    expect(wrapper.findAll('.bg-blue-500')).toHaveLength(0);
    expect(wrapper.findAll('div.bg-gray-600.transition-all')).toHaveLength(2);
  });

  it('rotates handles clockwise', async () => {
    const wrapper = mount(ZoneHandleEditor, {
      props: {
        zoneName: 'Test Zone',
        initialHandles: [
          { id: 'n', left: '50.00%', top: '0.00%' }
        ],
        isToggleMode: true
      }
    });

    const rotateBtn = wrapper.findAll('button').find(b => b.text().includes('↻'));
    await rotateBtn?.trigger('click');

    // N (50, 0) rotated 90 CW should be E (100, 50)
    const handle = wrapper.find('div.transition-all');
    const style = handle.attributes('style');
    expect(style).toMatch(/left:\s*100(\.00)?%/);
    expect(style).toMatch(/top:\s*50(\.00)?%/);
  });

  it('rotates handles counter-clockwise', async () => {
    const wrapper = mount(ZoneHandleEditor, {
      props: {
        zoneName: 'Test Zone',
        initialHandles: [
          { id: 'n', left: '50.00%', top: '0.00%' }
        ],
        isToggleMode: true
      }
    });

    const rotateBtn = wrapper.findAll('button').find(b => b.text().includes('↺'));
    await rotateBtn?.trigger('click');

    // N (50, 0) rotated 90 CCW should be W (0, 50)
    const handle = wrapper.find('div.transition-all');
    const style = handle.attributes('style');
    expect(style).toMatch(/left:\s*0(\.00)?%/);
    expect(style).toMatch(/top:\s*50(\.00)?%/);
  });

  it('emits save with updated handles', async () => {
    const wrapper = mount(ZoneHandleEditor, {
      props: {
        zoneName: 'Test Zone',
        initialHandles,
        isToggleMode: true
      }
    });

    const rotateBtn = wrapper.findAll('button').find(b => b.text().includes('↻'));
    await rotateBtn?.trigger('click');

    const saveBtn = wrapper.findAll('button').find(b => b.text() === 'Save Changes');
    await saveBtn?.trigger('click');

    const saveEvent = wrapper.emitted('save');
    expect(saveEvent).toBeTruthy();
    const emittedHandles = saveEvent![0][0] as any[];
    // N (50, 0) became E (100, 50)
    expect(emittedHandles.find(h => h.id === '1').left).toBe('100.00%');
    expect(emittedHandles.find(h => h.id === '1').top).toBe('50.00%');
    // E (100, 50) became S (50, 100)
    expect(emittedHandles.find(h => h.id === '2').left).toBe('50.00%');
    expect(emittedHandles.find(h => h.id === '2').top).toBe('100.00%');
  });

  it('uses 6 handles for C shape maps', () => {
    const cHandles = getDefaultHandles('c');
    expect(cHandles).toHaveLength(6);
    expect(cHandles.find(h => h.id === 'c-p1')).toBeDefined();
    expect(cHandles.find(h => h.id === 'c-p2')).toBeDefined();
    expect(cHandles.find(h => h.id === 'c-p3')).toBeDefined();
    expect(cHandles.find(h => h.id === 'c-p4')).toBeDefined();
    expect(cHandles.find(h => h.id === 'c-p5')).toBeDefined();
    expect(cHandles.find(h => h.id === 'c-p6')).toBeDefined();
  });

  it('clears all handles when Clear All is clicked', async () => {
    const wrapper = mount(ZoneHandleEditor, {
      props: {
        zoneName: 'Test Zone',
        initialHandles,
        isToggleMode: false
      }
    });

    expect(wrapper.findAll('div.transition-all')).toHaveLength(2);

    const clearBtn = wrapper.findAll('button').find(b => b.text() === 'Clear All');
    expect(clearBtn).toBeTruthy();
    await clearBtn?.trigger('click');

    expect(wrapper.findAll('div.transition-all')).toHaveLength(0);
  });
});
