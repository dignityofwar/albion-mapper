<script setup lang="ts">
import { ZONE_BUTTON_BG_DEFAULT, ZONE_BUTTON_BG_HAS_REDS, ZONE_BUTTON_HOVER_DEFAULT, ZONE_BUTTON_HOVER_HAS_REDS } from '../../../constants/ui';
import { TooltipRoot, TooltipTrigger, TooltipContent, TooltipPortal } from 'reka-ui';
import { ref, watch, nextTick } from 'vue';

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
      <div class="relative group">
        <button 
          @click.stop="$emit('toggle')" 
          class="text-white py-1 pl-2 pr-1 leading-none transition-all duration-300 flex items-center relative group"
          :class="[
            editing ? 'min-w-[115px] pr-6' : (active ? 'min-w-[80px] pr-2' : 'min-w-[40px]')
          ]"
        >
          <!-- Background Shape -->
          <div 
            class="absolute inset-y-[1px] right-[1px] left-[-15px] transition-all duration-300 core-shape rounded-tr-md rounded br-md"
            :class="[
              active ? '' : (hasReds ? ZONE_BUTTON_BG_HAS_REDS : ZONE_BUTTON_BG_DEFAULT),
              editing ? 'ring-2 ring-inset ring-white' : ''
            ]"
            :style="active ? { 
              backgroundColor: `${config[type].color}33`,
              border: `1px solid ${config[type].color}`,
              boxShadow: `0 4px 10px -2px ${config[type].shadow}`
            } : {}"
          ></div>

          <div class="flex items-center relative z-10 gap-1">
            <img :src="config[type].img" class="w-6 h-6 p-[2px] shrink-0" />
            
            <Transition name="timer">
              <span v-if="label && !editing" class="text-[13px] font-bold leading-none whitespace-nowrap overflow-hidden text-slate-200">{{ label }}</span>
            </Transition>

            <Transition name="fade">
              <div v-if="editing" class="flex items-center gap-1 overflow-hidden whitespace-nowrap">
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
              class="nodrag absolute right-0 top-0 bottom-0 w-6 flex items-center justify-center text-white text-[10px] transition-colors z-20 group/clear"
              title="Clear Timer"
            >
              <div class="absolute inset-y-[1px] right-[1px] left-0 bg-red-600 group-hover/clear:bg-red-500 transition-all duration-300"></div>
              <span class="relative z-30">✕</span>
            </button>
          </Transition>
        </button>
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
.rhombus-button {
  transform: skewX(-45deg);
}

.core-shape {
  clip-path: polygon(30px 0, 100% 0, 100% 100%, 0 100%);
}

.timer-enter-active {
  transition: all 0.3s ease;
  transition-delay: 150ms;
}

.timer-leave-active {
  transition: all 0.3s ease;
}

.timer-enter-from,
.timer-leave-to {
  opacity: 0;
}

.timer-enter-to,
.timer-leave-from {
  opacity: 1;
}

.fade-enter-active {
  transition: opacity 0.3s ease;
  transition-delay: 150ms;
}

.fade-leave-active {
  transition: opacity 0.3s ease;
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
