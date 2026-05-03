<script setup lang="ts">
import { NodeFeatures } from 'shared';
import ZoneCores from './ZoneCores.vue';
import { ref } from 'vue';

const props = defineProps<{
  features?: NodeFeatures;
  activeEditingCore: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | 'powercoreYellow' | null;
  now: number;
  hasReds: boolean;
  timerValue: string;
  isTimerTooLong: boolean;
  isTimerValid: boolean;
  cores?: ('powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | 'powercoreYellow')[];
  side?: 'left' | 'right';
}>();

const emit = defineEmits<{
  (e: 'toggle', feature: any): void;
  (e: 'update:timerValue', val: string): void;
  (e: 'save'): void;
  (e: 'clear'): void;
  (e: 'focus'): void;
  (e: 'blur'): void;
  (e: 'unlock', core: string): void;
  (e: 'lock', core: string): void;
}>();

const timerComponentRef = ref<InstanceType<typeof ZoneCores> | null>(null);

defineExpose({
  focus: () => timerComponentRef.value?.focus(),
  blur: () => timerComponentRef.value?.blur(),
});
</script>

<template>
  <div class="transition-colors duration-300">
    <ZoneCores 
      ref="timerComponentRef"
      :features="features"
      :active-editing-core="activeEditingCore"
      :now="now"
      :has-reds="hasReds"
      :timer-value="timerValue"
      :is-timer-too-long="isTimerTooLong"
      :is-timer-valid="isTimerValid"
      :cores="cores"
      :side="side"
      @update:timer-value="emit('update:timerValue', $event)"
      @toggle="emit('toggle', $event)"
      @save="emit('save')"
      @clear="emit('clear')"
      @focus="emit('focus')"
      @blur="emit('blur')"
      @unlock="emit('unlock', $event)"
      @lock="emit('lock', $event)"
    />
  </div>
</template>
