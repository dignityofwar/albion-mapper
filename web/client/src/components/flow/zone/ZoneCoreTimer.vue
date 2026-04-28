<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  activeEditingCore: string | null;
  modelValue: string;
  isTimerTooLong: boolean;
  isTimerValid: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'save'): void;
  (e: 'clear'): void;
  (e: 'focus'): void;
  (e: 'blur'): void;
}>();

const timerInputRef = ref<HTMLInputElement | null>(null);

function focus() {
  timerInputRef.value?.focus();
}

function blur() {
  timerInputRef.value?.blur();
}

defineExpose({ focus, blur });
</script>

<template>
  <Transition name="slide">
    <div v-if="activeEditingCore" class="mt-1.5 flex justify-center items-center gap-1 overflow-hidden">
      <input 
        ref="timerInputRef"
        type="text" 
        :value="modelValue"
        @input="e => emit('update:modelValue', (e.target as HTMLInputElement).value)"
        @focus="emit('focus')"
        @blur="emit('blur')"
        @keydown.enter="emit('save')"
        :placeholder="activeEditingCore ? 'MM:SS' : 'Select core'"
        :disabled="!activeEditingCore"
        :class="[
          'nodrag bg-gray-900 text-white text-[11px] w-14 text-center border rounded py-0.5 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
          isTimerTooLong ? 'border-red-500 text-red-500' : 'border-gray-600 focus:border-blue-400'
        ]"
        @click.stop
      />
      <button 
        @click.stop="emit('save')"
        :disabled="!activeEditingCore || (!isTimerValid && modelValue !== '') || isTimerTooLong"
        class="nodrag bg-blue-600 hover:bg-blue-500 text-white rounded px-1.5 py-0.5 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Save Timer"
      >
        ↵
      </button>
      <button 
        @click.stop="emit('clear')"
        :disabled="!activeEditingCore"
        class="nodrag bg-red-600 hover:bg-red-500 text-white rounded px-1.5 py-0.5 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Clear Timer"
      >
        ✕
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease-in-out;
  max-height: 40px;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
  margin-top: 0 !important;
}
</style>
