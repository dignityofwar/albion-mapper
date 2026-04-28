<script setup lang="ts">
import { ZONE_BUTTON_BG_DEFAULT, ZONE_BUTTON_BG_HAS_REDS, ZONE_BUTTON_HOVER_DEFAULT, ZONE_BUTTON_HOVER_HAS_REDS } from '../../../constants/ui';
const props = defineProps<{
  type: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple';
  active: boolean;
  editing: boolean;
  hasReds?: boolean;
  activeRingClass?: string;
  label?: string;
}>();

defineEmits<{
  (e: 'toggle'): void;
}>();

const config = {
  powercoreGreen: { title: 'Green Core', img: '/images/core-green.png', colorClass: 'bg-green-700', hoverClass: 'hover:bg-green-500' },
  powercoreBlue: { title: 'Blue Core', img: '/images/core-blue.png', colorClass: 'bg-blue-700', hoverClass: 'hover:bg-blue-500' },
  powercorePurple: { title: 'Purple Core', img: '/images/core-purple.png', colorClass: 'bg-purple-700', hoverClass: 'hover:bg-purple-500' },
};
</script>

<template>
  <button 
    @click.stop="$emit('toggle')" 
    :class="[
      active ? config[type].colorClass : (hasReds ? ZONE_BUTTON_BG_HAS_REDS : ZONE_BUTTON_BG_DEFAULT),
      active ? activeRingClass : '',
      editing ? 'ring-2 ring-white' : (active ? 'ring-1' : ''),
      active ? config[type].hoverClass : (hasReds ? ZONE_BUTTON_HOVER_HAS_REDS : ZONE_BUTTON_HOVER_DEFAULT)
    ]" 
    class="text-white rounded p-1 ring-inset leading-none transition-colors flex items-center overflow-hidden" 
    :title="config[type].title"
  >
    <img :src="config[type].img" class="w-6 h-6 p-[2px]" />
    <Transition name="timer">
      <span v-if="label" class="mx-1 text-[12px] leading-none whitespace-nowrap overflow-hidden">{{ label }}</span>
    </Transition>
  </button>
</template>

<style scoped>
.timer-enter-active,
.timer-leave-active {
  transition: all 0.3s ease;
}

.timer-enter-from,
.timer-leave-to {
  opacity: 0;
  max-width: 0;
  margin-left: 0;
  margin-right: 0;
}

.timer-enter-to,
.timer-leave-from {
  opacity: 1;
  max-width: 100px;
  margin-left: 0.25rem;
  margin-right: 0.25rem;
}
</style>
