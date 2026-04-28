<script setup lang="ts">
import { ZONE_BUTTON_BG_DEFAULT, ZONE_BUTTON_RING_ACTIVE_HAS_REDS } from '../../../constants/ui';
import { ref, watch, nextTick, computed } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { TooltipRoot, TooltipTrigger, TooltipContent, TooltipPortal } from 'reka-ui';

const props = defineProps<{
  reds: number | null | undefined;
  isOpen: boolean;
  now?: number;
  redsTimer?: number;
}>();

const emit = defineEmits<{
  (e: 'update:reds', value: number | null | undefined): void;
  (e: 'update:isOpen', value: boolean): void;
}>();

const redsValue = ref<string>('');
const redsInputRef = ref<HTMLInputElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const isFocused = ref(false);

onClickOutside(containerRef, () => {
  if (props.isOpen) {
    emit('update:isOpen', false);
  }
});

watch(() => props.reds, (newVal) => {
  if (isFocused.value) return;
  
  if (newVal === null) {
    redsValue.value = '?';
  } else if (newVal !== undefined) {
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
    emit('update:reds', null);
    emit('update:isOpen', true);
    nextTick(() => {
      redsInputRef.value?.focus();
    });
  }
}

function handleInput() {
  if (redsValue.value === '' || redsValue.value === null) {
    emit('update:reds', null);
  } else {
    const val = parseInt(redsValue.value, 10);
    if (isNaN(val)) {
      emit('update:reds', null);
    } else {
      emit('update:reds', val);
    }
  }
}

function onFocus() {
  isFocused.value = true;
  if (redsValue.value === '?') {
    redsValue.value = '';
  }
}

function onBlur() {
  isFocused.value = false;
  if (redsValue.value === '' && props.reds !== undefined) {
    redsValue.value = '?';
    emit('update:reds', null);
  }
}

const isActuallyActive = computed(() => {
  if (props.reds === undefined) return false;
  if (props.redsTimer && props.now && props.redsTimer <= props.now) return false;
  return true;
});

const tooltipText = computed(() => {
  if (!isActuallyActive.value || !props.redsTimer || !props.now) return 'Reds';
  const remaining = Math.max(0, Math.floor((props.redsTimer - props.now) / 1000));
  if (remaining <= 0) return 'Reds';
  
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `Reds (expires in ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')})`;
});
</script>

<template>
  <div ref="containerRef" class="flex items-center">
    <TooltipRoot>
      <TooltipTrigger as-child>
        <button 
          @click.stop="handleToggle" 
          :class="[
            (isActuallyActive || isOpen) ? `bg-red-700 ${ZONE_BUTTON_RING_ACTIVE_HAS_REDS} ring-1` : ZONE_BUTTON_BG_DEFAULT,
            'text-white rounded p-1 ring-inset leading-none transition-all hover:opacity-80 flex items-center justify-center overflow-hidden'
          ]" 
        >
          <img src="/images/reds.png" class="w-6 h-6 p-[2px]" alt="Reds" />
          <Transition name="slide-right">
            <input
              v-if="isOpen || isActuallyActive"
              ref="redsInputRef"
              type="text"
              inputmode="numeric"
              v-model="redsValue"
              @input="handleInput"
              @focus="onFocus"
              @blur="onBlur"
              @click.stop
              class="nodrag bg-transparent text-white text-[14px] w-4 text-center border-none outline-none leading-none p-0"
              placeholder="?"
            />
          </Transition>
        </button>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent 
          class="bg-black text-white text-xs px-2 py-1 rounded shadow-lg z-50 side-top animate-in fade-in zoom-in duration-200"
          :side-offset="5"
        >
          {{ tooltipText }}
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </div>
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
