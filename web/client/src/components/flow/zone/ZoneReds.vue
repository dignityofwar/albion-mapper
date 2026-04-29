<script setup lang="ts">
import { ZONE_BUTTON_BG_DEFAULT, ZONE_BUTTON_RING_ACTIVE_HAS_REDS, ZONE_BUTTON_HOVER_REDS, ZONE_BUTTON_HOVER_INACTIVE } from '../../../constants/ui';
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

const containerStyle = computed(() => {
  const targetWidth = (isActuallyActive.value || props.isOpen) ? '115px' : '80px';
  const style: any = {
    width: targetWidth,
    '--target-width': targetWidth,
  };

  if (isActuallyActive.value || props.isOpen) {
    style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
    style.boxShadow = 'inset 0 0 0 1px #ef4444, 0 4px 10px -2px rgba(239, 68, 68, 0.5)';
    style['--hover-bg'] = 'rgba(239, 68, 68, 0.35)';
  }

  return style;
});

const tooltipText = computed(() => {
  if (!isActuallyActive.value || !props.redsTimer || !props.now) return 'Reds';
  const remaining = Math.max(0, Math.floor((props.redsTimer - props.now) / 1000));
  if (remaining <= 0) return 'Reds';
  
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `Reds (expires in ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')})`;
});

const timerLabel = computed(() => {
  if (!isActuallyActive.value || !props.redsTimer || !props.now) return '';
  const remaining = Math.max(0, Math.floor((props.redsTimer - props.now) / 1000));
  if (remaining <= 0) return '';
  
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <div 
        ref="containerRef"
        @click.stop="handleToggle" 
        class="reds-container relative group cursor-pointer overflow-visible shrink-0 rounded-tl-md rounded-bl-md"
        :class="[
          (isActuallyActive || isOpen) ? '' : `${ZONE_BUTTON_BG_DEFAULT} ${ZONE_BUTTON_HOVER_INACTIVE}`,
          { 'active': isActuallyActive || isOpen }
        ]"
        :style="containerStyle"
      >
        <!-- Background/Border is handled by the container itself -->
        <div class="flex items-center justify-end h-full pr-6 relative z-10">
          <!-- Left Div: Input and Time -->
          <Transition name="fade-slide">
            <div v-if="isOpen || isActuallyActive" class="flex flex-col items-end mr-2 shrink-0 overflow-hidden">
              <input
                ref="redsInputRef"
                type="text"
                inputmode="numeric"
                v-model="redsValue"
                @input="handleInput"
                @focus="onFocus"
                @blur="onBlur"
                @click.stop
                class="nodrag bg-gray-950/50 text-white text-[12px] font-bold w-6 h-5 text-center border rounded h-5 px-0 leading-none outline-none transition-colors border-gray-600 focus:border-blue-400"
                placeholder="?"
              />
              <div v-if="timerLabel" class="text-[10px] font-bold leading-none text-slate-200 mt-0.5">
                {{ timerLabel }}
              </div>
            </div>
          </Transition>

          <!-- Right Div: Logo -->
          <div class="shrink-0 flex items-center justify-center">
            <img src="/images/reds.png" class="w-8 h-8 p-[2px]" alt="Reds" />
          </div>
        </div>
      </div>
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
</template>

<style scoped>
.reds-container {
  height: 44px;
  width: var(--target-width, 44px);
  min-width: 44px;
  transition: width 0.3s ease, padding-left 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease;
  clip-path: polygon(0 0, calc(100% - 44px) 0, 100% 100%, 0 100%);
  padding-left: 8px;
  padding-right: 16px;
}

.reds-container.active {
  padding-left: 8px;
}

.reds-container.active:hover {
  background-color: var(--hover-bg, rgba(239, 68, 68, 0.35)) !important;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
</style>
