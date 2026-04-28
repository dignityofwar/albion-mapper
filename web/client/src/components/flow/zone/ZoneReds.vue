<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

const props = defineProps<{
  reds: number | undefined;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:reds', value: number | undefined): void;
  (e: 'update:isOpen', value: boolean): void;
}>();

const redsValue = ref<string>('');
const redsInputRef = ref<HTMLInputElement | null>(null);

watch(() => props.reds, (newVal) => {
  if (newVal !== undefined && newVal !== null) {
    redsValue.value = String(newVal);
  } else {
    redsValue.value = '';
  }
}, { immediate: true });

function handleToggle() {
  if (props.reds !== undefined) {
    emit('update:reds', undefined);
    emit('update:isOpen', false);
  } else {
    const nextOpen = !props.isOpen;
    emit('update:isOpen', nextOpen);
    if (nextOpen) {
      nextTick(() => {
        redsInputRef.value?.focus();
      });
    }
  }
}

function handleInput() {
  if (redsValue.value === '' || redsValue.value === null) {
    emit('update:reds', undefined);
  } else {
    const val = parseInt(String(redsValue.value), 10);
    if (isNaN(val)) {
      emit('update:reds', undefined);
    } else {
      emit('update:reds', val);
    }
  }
}
</script>

<template>
  <button 
    @click.stop="handleToggle" 
    :class="[
      (props.reds !== undefined || isOpen) ? 'bg-red-700 border-red-400' : 'bg-gray-700 border-transparent',
      'text-white rounded p-1 border leading-none transition-all hover:opacity-80 flex items-center justify-center overflow-hidden gap-0'
    ]" 
    title="Reds"
  >
    <img src="/images/reds.png" class="w-6 h-6 p-[2px]" alt="Reds" />
    <Transition name="slide-right">
      <input 
        v-if="isOpen || props.reds !== undefined"
        ref="redsInputRef"
        type="number"
        v-model="redsValue"
        @input="handleInput"
        @click.stop
        class="nodrag bg-transparent text-white text-[14px] w-4 text-center border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none leading-none p-0"
        placeholder="0"
      />
    </Transition>
  </button>
</template>

<style scoped>
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s ease-in-out;
  max-width: 50px;
  overflow: hidden;
}

.slide-right-enter-from,
.slide-right-leave-to {
  max-width: 0;
  opacity: 0;
}
</style>
