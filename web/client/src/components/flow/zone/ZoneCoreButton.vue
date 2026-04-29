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
          :class="[
            active ? 'bg-slate-900/90' : (hasReds ? ZONE_BUTTON_BG_HAS_REDS : ZONE_BUTTON_BG_DEFAULT),
            editing ? 'ring-2 ring-white' : ''
          ]" 
          class="text-white p-1.5 ring-inset leading-none transition-all flex items-center rhombus-button min-w-[44px] relative overflow-hidden"
        >
          <div class="flex items-center unskew-content">
            <img :src="config[type].img" class="w-7 h-7 p-[2px] shrink-0" />
            
            <Transition name="timer">
              <span v-if="label && !editing" class="ml-2 text-[13px] font-bold leading-none whitespace-nowrap overflow-hidden text-slate-200">{{ label }}</span>
            </Transition>

            <Transition name="slide">
              <div v-if="editing" class="ml-2 flex items-center gap-1 overflow-hidden whitespace-nowrap">
                <input 
                  ref="timerInputRef"
                  type="text" 
                  :value="timerValue"
                  @input="e => emit('update:timerValue', (e.target as HTMLInputElement).value)"
                  @focus="emit('focus')"
                  @blur="emit('blur')"
                  @keydown.enter="emit('save')"
                  placeholder="MM:SS"
                  class="nodrag bg-gray-950/50 text-white text-[12px] font-bold w-16 text-center border rounded py-0.5 outline-none transition-colors border-gray-600 focus:border-blue-400"
                  :class="{ 'border-red-500 text-red-500': isTimerTooLong }"
                  @click.stop
                />
                <button 
                  @click.stop="emit('clear')"
                  class="nodrag bg-red-600 hover:bg-red-500 text-white rounded px-1.5 py-0.5 text-[10px] transition-colors"
                  title="Clear Timer"
                >
                  ✕
                </button>
              </div>
            </Transition>
          </div>
          <!-- Bottom colored line -->
          <div 
            v-if="active" 
            class="absolute bottom-0 left-0 right-0 h-[2px] transition-all duration-300"
            :style="{ 
              backgroundColor: config[type].color, 
              boxShadow: `0 0 10px ${config[type].shadow}`
            }"
          ></div>
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
  transform: skewY(-45deg);
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}

.unskew-content {
  transform: skewY(45deg) rotate(-45deg);
}

.timer-enter-active,
.timer-leave-active {
  transition: all 0.3s ease;
}

.timer-enter-from,
.timer-leave-to {
  opacity: 0;
  max-width: 0;
  margin-left: 0;
}

.timer-enter-to,
.timer-leave-from {
  opacity: 1;
  max-width: 100px;
  margin-left: 0.5rem;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease-in-out;
  max-width: 150px;
}

.slide-enter-from,
.slide-leave-to {
  max-width: 0;
  opacity: 0;
  margin-left: 0 !important;
}
</style>
