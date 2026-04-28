<script setup lang="ts">
import { ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: number | null;
  compact?: boolean;
}>(), {
  compact: false,
});

const emit = defineEmits(['update:modelValue', 'enter']);

const hours = ref<number | null>(null);
const minutes = ref<number | null>(null);
const seconds = ref<number | null>(null);

watch([hours, minutes, seconds], () => {
  let h = Number(hours.value ?? 0);
  let m = Number(minutes.value ?? 0);
  let s = Number(seconds.value ?? 0);
  
  const isEmpty = (val: number | null | string) => val === null || val === '';
  
  if (isEmpty(hours.value) && isEmpty(minutes.value) && isEmpty(seconds.value)) {
    emit('update:modelValue', null);
    return;
  }
  
  let clamped = false;
  if (h > 23) {
    h = 23;
    m = 59;
    s = 59;
    clamped = true;
  } else if (h === 23) {
    if (m > 59) {
      m = 59;
      s = 59;
      clamped = true;
    } else if (m === 59) {
      if (s > 59) {
        s = 59;
        clamped = true;
      }
    }
  } else {
    if (m > 59) {
      m = 59;
      clamped = true;
    }
    if (s > 59) {
      s = 59;
      clamped = true;
    }
  }

  if (clamped) {
    hours.value = h;
    minutes.value = m;
    seconds.value = s;
  }
  
  emit('update:modelValue', h * 3600 + m * 60 + s);
});

watch(() => props.modelValue, (newVal) => {
  if (newVal === null) {
    hours.value = null;
    minutes.value = null;
    seconds.value = null;
  }
});

const hoursEl = ref<HTMLInputElement | null>(null);

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    emit('enter');
    return;
  }
  // Allow control keys
  if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
    return;
  }
  
  // Prevent if not a digit
  if (!/^\d$/.test(e.key)) {
    e.preventDefault();
  }
}

defineExpose({
  focus: () => {
    hoursEl.value?.focus();
  }
});
</script>

<template>
  <div 
    class="flex items-center justify-center bg-gray-800 border rounded border-gray-600 transition-colors focus-within:border-white"
    :class="compact ? 'px-2 py-1' : 'px-3 py-2.5 md:py-2'"
  >
    <input
      ref="hoursEl"
      type="number"
      v-model.number="hours"
      placeholder="HH"
      class="w-8 bg-transparent py-0 text-white text-sm leading-none outline-none text-center"
      min="0"
      max="23"
      @keydown="onKeydown"
    />
    <span class="text-gray-400 leading-none">:</span>
    <input
      type="number"
      v-model.number="minutes"
      placeholder="MM"
      class="w-8 bg-transparent py-0 text-white text-sm leading-none outline-none text-center"
      min="0"
      max="59"
      @keydown="onKeydown"
    />
    <span class="text-gray-400 leading-none">:</span>
    <input
      type="number"
      v-model.number="seconds"
      placeholder="SS"
      class="w-8 bg-transparent py-0 text-white text-sm leading-none outline-none text-center"
      min="0"
      max="59"
      @keydown="onKeydown"
    />
  </div>
</template>

<style scoped>
/* Chrome, Safari, Edge, Opera */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Firefox */
input[type=number] {
  -moz-appearance: textfield;
}
</style>
