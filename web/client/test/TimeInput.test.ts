import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TimeInput from '../src/components/common/TimeInput.vue';

describe('TimeInput', () => {
  it('should parse 30 seconds as 0.5 minutes', async () => {
    const wrapper = mount(TimeInput, {
      props: {
        modelValue: null,
      },
    });

    // We need to set hours, minutes, seconds manually if we can,
    // or if we can use the exposed ref to set them directly on the component instance.
    // The component uses v-model on refs internally (hours, minutes, seconds).
    
    // As in ReportForm.test.ts:
    // 39: await input.setValue('1:30'); 
    // This seems to work for TimeInput component, let's see how.
    // Oh wait, TimeInput doesn't have a setValue that understands 1:30. 
    // Maybe setValue in test-utils works for components?
    
    // Let's try to set the internal state directly, as I can access the VM.
    const vm = wrapper.vm as any;
    vm.hours = 0;
    vm.minutes = 0;
    vm.seconds = 30;
    
    // We need to trigger the watcher. 
    // The watcher is on [hours, minutes, seconds].
    // Updating them should trigger the watcher.
    
    await wrapper.vm.$nextTick();
    
    // Now check the emitted value.
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeDefined();
    // The last emitted value
    expect(emitted![emitted!.length - 1][0]).toBe(0.5);
  });

  it('should emit null when all inputs are empty', async () => {
    const wrapper = mount(TimeInput, {
      props: { modelValue: null },
    });

    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('');
    await inputs[1].setValue('');
    await inputs[2].setValue('');
    
    await wrapper.vm.$nextTick();

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeDefined();
    expect(emitted![emitted!.length - 1][0]).toBeNull();
  });
});
