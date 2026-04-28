<script setup lang="ts">
import { NodeFeatures } from 'shared';
import ZoneCores from './ZoneCores.vue';
import ZoneReds from './ZoneReds.vue';
import ZoneCoreTimer from './ZoneCoreTimer.vue';
import { ref } from 'vue';

const props = defineProps<{
  features?: NodeFeatures;
  activeEditingCore: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | null;
  now: number;
  hasReds: boolean;
  timerValue: string;
  isTimerTooLong: boolean;
  isTimerValid: boolean;
  isRedsOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle', feature: any): void;
  (e: 'update:reds', val: number | null | undefined): void;
  (e: 'update:timerValue', val: string): void;
  (e: 'update:isRedsOpen', val: boolean): void;
  (e: 'save'): void;
  (e: 'clear'): void;
  (e: 'focus'): void;
  (e: 'blur'): void;
}>();

const timerComponentRef = ref<{ focus: () => void; blur: () => void } | null>(null);

defineExpose({
  focus: () => timerComponentRef.value?.focus(),
  blur: () => timerComponentRef.value?.blur(),
});
</script>

<template>
  <div 
    class="my-2 border-y py-2 transition-colors duration-300"
    :class="hasReds ? 'border-red-500' : 'border-gray-700'"
  >
    <div class="flex items-center justify-center gap-1.5">
      <ZoneCores 
        :features="features"
        :active-editing-core="activeEditingCore"
        :now="now"
        :has-reds="hasReds"
        @toggle="emit('toggle', $event)"
      />
      <ZoneReds 
        :reds="features?.reds"
        :is-open="isRedsOpen"
        @update:is-open="emit('update:isRedsOpen', $event)"
        @update:reds="emit('update:reds', $event)"
      />
    </div>

    <ZoneCoreTimer 
      ref="timerComponentRef"
      :model-value="timerValue"
      @update:model-value="emit('update:timerValue', $event)"
      :active-editing-core="activeEditingCore"
      :is-timer-too-long="isTimerTooLong"
      :is-timer-valid="isTimerValid"
      @save="emit('save')"
      @clear="emit('clear')"
      @focus="emit('focus')"
      @blur="emit('blur')"
    />
  </div>
</template>
