<script setup lang="ts">
import { ZONE_BUTTON_BG_DEFAULT, ZONE_BUTTON_BG_HAS_REDS, ZONE_BUTTON_HOVER_DEFAULT, ZONE_BUTTON_HOVER_HAS_REDS } from '../../../constants/ui';
import { TooltipRoot, TooltipTrigger, TooltipContent, TooltipPortal } from 'reka-ui';
import { ref, watch, nextTick, computed } from 'vue';

const props = defineProps<{
  type: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | 'powercoreYellow';
  active: boolean;
  editing: boolean;
  hasReds?: boolean;
  activeRingClass?: string;
  label?: string;
  timerValue?: string;
  isTimerTooLong?: boolean;
  isTimerValid?: boolean;
  isUnlocked?: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle'): void;
  (e: 'update:timerValue', value: string): void;
  (e: 'save'): void;
  (e: 'clear'): void;
  (e: 'focus'): void;
  (e: 'blur'): void;
  (e: 'unlock'): void;
  (e: 'lock'): void;
}>();

const config = {
  powercoreGreen: { title: 'Green Core', img: '/images/core-green.png', color: '#4ade80', shadow: 'rgba(74, 222, 128, 0.5)' },
  powercoreBlue: { title: 'Blue Core', img: '/images/core-blue.png', color: '#60a5fa', shadow: 'rgba(96, 165, 250, 0.5)' },
  powercorePurple: { title: 'Purple Core', img: '/images/core-purple.png', color: '#c084fc', shadow: 'rgba(192, 132, 252, 0.5)' },
  powercoreYellow: { title: 'Yellow Core', img: '/images/core-yellow.png', color: '#facc15', shadow: 'rgba(250, 204, 21, 0.5)' },
};

const timerInputRef = ref<HTMLInputElement | null>(null);

const containerStyle = computed(() => {
  const targetWidth = props.editing ? '160px' : (props.active ? '110px' : '60px');
  const style: any = {
    width: targetWidth,
    '--target-width': targetWidth,
  };

  if (props.active) {
    style.backgroundColor = `${config[props.type].color}33`;
    style.boxShadow = `inset 0 0 0 1px ${config[props.type].color}, 0 4px 10px -2px ${config[props.type].shadow}`;
  }
  
  if (props.editing) {
    style.boxShadow = `inset 0 0 0 1px ${config[props.type].color}, 0 4px 10px -2px ${config[props.type].shadow}`;
  }

  return style;
});

watch(() => props.editing, (isEditing) => {
  if (isEditing) {
    nextTick(() => {
      timerInputRef.value?.focus();
    });
  }
});

defineExpose({
  focus: () => timerInputRef.value?.focus(),
  blur: () => timerInputRef.value?.blur(),
});
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <div 
        @click.stop="$emit('toggle')" 
        class="core-container relative group cursor-pointer overflow-visible shrink-0 rounded-tr-md rounded-br-md"
        :class="[
          active ? '' : (hasReds ? ZONE_BUTTON_BG_HAS_REDS : ZONE_BUTTON_BG_DEFAULT),
          { 'active': active, 'editing': editing }
        ]"
        :style="containerStyle"
      >
        <!-- Background/Border is handled by the container itself via clip-path and styles -->
        <div class="flex items-center h-full pl-4 gap-1 relative z-10">
          <img :src="config[type].img" class="w-6 h-6 p-[2px] shrink-0" />
          
          <Transition name="fade" mode="out-in">
            <div v-if="label && !editing" key="timer" class="flex items-center gap-1.5">
              <span class="text-[13px] font-bold leading-none whitespace-nowrap overflow-hidden text-slate-200 shrink-0">{{ label }}</span>
            </div>
            <div v-else-if="!label && active && !editing" key="unlocked" class="flex items-center justify-center pr-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
              </svg>
            </div>
            <div v-else-if="editing" key="editing" class="flex items-center gap-2 overflow-hidden whitespace-nowrap shrink-0">
              <div class="relative flex items-center gap-1">
                <input 
                  v-if="!isUnlocked"
                  ref="timerInputRef"
                  type="text" 
                  :value="timerValue"
                  @input="e => emit('update:timerValue', (e.target as HTMLInputElement).value)"
                  @focus="emit('focus')"
                  @blur="emit('blur')"
                  @keydown.enter="emit('save')"
                  placeholder="MM:SS"
                  class="nodrag bg-gray-950/50 text-white text-[12px] font-bold w-[48px] text-center border rounded h-5 px-0 leading-none outline-none transition-colors border-gray-600 focus:border-blue-400"
                  :class="{ 'border-red-500 text-red-500': isTimerTooLong }"
                  @click.stop
                />
                <div v-else class="w-[48px] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                  </svg>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Lock/Unlock and X Buttons -->
        <Transition name="fade">
          <div v-if="editing" class="absolute right-0 top-0 bottom-0 flex z-20">
            <button 
              v-if="!isUnlocked"
              @click.stop="emit('unlock')"
              class="nodrag w-6 flex items-center justify-center text-white transition-colors bg-yellow-600 hover:bg-yellow-500 border-none outline-none"
              title="Unlock Core"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
              </svg>
            </button>
            <button 
              v-else
              @click.stop="emit('lock')"
              class="nodrag w-6 flex items-center justify-center text-blue-400 transition-colors bg-gray-600 hover:bg-gray-500 border-none outline-none"
              title="Lock Core"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </button>
            <button 
              @click.stop="emit('clear')"
              class="nodrag w-6 flex items-center justify-center text-white text-[10px] transition-colors group/clear bg-red-600 hover:bg-red-500 border-none outline-none rounded-tr-md rounded-br-md"
              title="Clear Timer"
            >
              <span class="relative z-30">✕</span>
            </button>
          </div>
        </Transition>
      </div>
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent 
        class="bg-black text-white text-xs px-2 py-1 rounded shadow-lg z-50 side-top animate-in fade-in zoom-in duration-200"
        :side-offset="5"
      >
        {{ config[type].title }}
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>

<style scoped>
.core-container {
  height: 32px;
  width: var(--target-width, 44px);
  min-width: 44px;
  transition: width 0.3s ease, padding-right 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease;
  clip-path: polygon(32px 0, 100% 0, 100% 100%, 0 100%);
  padding-right: 8px;
  padding-left: 12px;
}

.core-container.active {
  padding-right: 8px;
}

.core-container.editing {
  padding-right: 48px;
}

.fade-enter-active {
  transition: opacity 0.15s ease;
}

.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}
</style>
