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
            (isActuallyActive || isOpen) ? 'bg-slate-900/90' : ZONE_BUTTON_BG_DEFAULT,
            'text-white p-1.5 ring-inset leading-none transition-all flex items-center justify-center rhombus-button min-w-[44px] relative overflow-hidden'
          ]" 
        >
          <div class="flex items-center unskew-content">
            <Transition name="slide-left">
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
                class="nodrag bg-transparent text-white text-[14px] w-6 text-center border-none outline-none font-bold leading-none p-0 mr-1"
                placeholder="?"
              />
            </Transition>
            <img src="/images/reds.png" class="w-7 h-7 p-[2px] shrink-0" alt="Reds" />
          </div>
          <!-- Bottom red line -->
          <div 
            v-if="isActuallyActive" 
            class="absolute bottom-0 left-0 right-0 h-[2px] bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] transition-all duration-300"
          ></div>
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
.rhombus-button {
  transform: skewY(45deg);
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}

.unskew-content {
  transform: skewY(-45deg) rotate(45deg);
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s ease-in-out;
  max-width: 50px;
  overflow: hidden;
}

.slide-left-enter-from,
.slide-left-leave-to {
  max-width: 0;
  opacity: 0;
}
</style>
