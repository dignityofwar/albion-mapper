<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  modelValue: number | null;
}>();

const emit = defineEmits(['update:modelValue']);

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
  
  emit('update:modelValue', h * 60 + m + s / 60);
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
  <div class="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded px-3 py-2">
    <input
      ref="hoursEl"
      type="number"
      v-model="hours"
      placeholder="H"
      class="w-10 bg-transparent text-white text-sm outline-none text-center"
      min="0"
      max="23"
      @keydown="onKeydown"
    />
    <span class="text-gray-400">:</span>
    <input
      type="number"
      v-model="minutes"
      placeholder="MM"
      class="w-10 bg-transparent text-white text-sm outline-none text-center"
      min="0"
      max="59"
      @keydown="onKeydown"
    />
    <span class="text-gray-400">:</span>
    <input
      type="number"
      v-model="seconds"
      placeholder="SS"
      class="w-10 bg-transparent text-white text-sm outline-none text-center"
      min="0"
      max="59"
      @keydown="onKeydown"
    />
  </div>
</template>
