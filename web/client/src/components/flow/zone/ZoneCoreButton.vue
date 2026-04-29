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
}>();

const emit = defineEmits<{
  (e: 'toggle'): void;
  (e: 'update:timerValue', value: string): void;
  (e: 'save'): void;
  (e: 'clear'): void;
  (e: 'focus'): void;
  (e: 'blur'): void;
}>();

const config = {
  powercoreGreen: { title: 'Green Core', img: '/images/core-green.png', color: '#4ade80', shadow: 'rgba(74, 222, 128, 0.5)' },
  powercoreBlue: { title: 'Blue Core', img: '/images/core-blue.png', color: '#60a5fa', shadow: 'rgba(96, 165, 250, 0.5)' },
  powercorePurple: { title: 'Purple Core', img: '/images/core-purple.png', color: '#c084fc', shadow: 'rgba(192, 132, 252, 0.5)' },
  powercoreYellow: { title: 'Yellow Core', img: '/images/core-yellow.png', color: '#facc15', shadow: 'rgba(250, 204, 21, 0.5)' },
};

const timerInputRef = ref<HTMLInputElement | null>(null);

const containerStyle = computed(() => {
  const targetWidth = props.editing ? '135px' : (props.active ? '100px' : '60px');
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
            <span v-if="label && !editing" key="timer" class="text-[13px] font-bold leading-none whitespace-nowrap overflow-hidden text-slate-200 shrink-0">{{ label }}</span>
            <div v-else-if="editing" key="editing" class="flex items-center gap-1 overflow-hidden whitespace-nowrap shrink-0">
              <input 
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
            </div>
          </Transition>
        </div>

        <!-- X Button Rectangle -->
        <Transition name="fade">
          <button 
            v-if="editing"
            @click.stop="emit('clear')"
            class="nodrag absolute right-0 top-0 bottom-0 w-6 flex items-center justify-center text-white text-[10px] transition-colors z-20 group/clear bg-red-600 hover:bg-red-500 border-none outline-none rounded-tr-md rounded-br-md"
            title="Clear Timer"
          >
            <span class="relative z-30">✕</span>
          </button>
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
  padding-right: 24px;
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
