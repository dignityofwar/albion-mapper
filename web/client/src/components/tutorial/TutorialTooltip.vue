<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { Z_INDEX } from '@/constants/Layers';

const props = defineProps<{
  message: string;
  pointing?: 'up' | 'down' | 'left' | 'right';
  offsetX?: number;
  offsetY?: number;
  bounce?: boolean;
  target?: HTMLElement;
  containerClass?: string;
  textClass?: string;
}>();

const tooltipStyle = computed(() => {
  const x = props.offsetX || 0;
  const y = props.offsetY || 0;

  if (props.target) {
    const rect = props.target.getBoundingClientRect();
    const style: any = {
      position: 'fixed',
      left: props.pointing === 'left'
        ? `${rect.right + 10 + x}px`
        : props.pointing === 'right'
        ? `${rect.left - 10 + x}px`
        : `${rect.left + rect.width / 2 + x}px`,
      top: props.pointing === 'down'
        ? `${rect.top - 10 + y}px`
        : props.pointing === 'up'
        ? `${rect.bottom + 10 + y}px`
        : `${rect.top + rect.height / 2 + y}px`,
      transform: props.pointing === 'down'
        ? 'translateX(-50%) translateY(-100%)'
        : props.pointing === 'up'
        ? 'translateX(-50%)'
        : props.pointing === 'left'
        ? 'translateY(-50%)'
        : 'translateX(-100%) translateY(-50%)',
    };
    return style;
  }

  return {}; // Default for non-target tooltips
});
</script>

<template>
  <div
    :class="[Z_INDEX.UI_OVERLAY, { 'absolute': !target }, containerClass]"
    :style="tooltipStyle"
  >
    <div
      class="bg-blue-600 text-white text-center px-2 py-1 rounded shadow-lg w-full"
      :class="[textClass || 'text-xs', { 'animate-bounce-tooltip': bounce }]"
    >
      {{ message }}
      <!-- Arrow -->
      <div v-if="pointing === 'down'" class="absolute -bottom-1.5 left-1/2 w-4 h-2 bg-blue-600 [clip-path:polygon(0%_0%,100%_0%,50%_100%)] -translate-x-1/2"></div>
      <div v-if="pointing === 'up'" class="absolute -top-1.5 left-1/2 w-4 h-2 bg-blue-600 [clip-path:polygon(50%_0%,0%_100%,100%_100%)] -translate-x-1/2"></div>
      <div v-if="pointing === 'left'" class="absolute -left-1.5 top-1/2 w-2 h-4 bg-blue-600 [clip-path:polygon(0%_50%,100%_0%,100%_100%)] -translate-y-1/2"></div>
      <div v-if="pointing === 'right'" class="absolute -right-1.5 top-1/2 w-2 h-4 bg-blue-600 [clip-path:polygon(0%_0%,100%_50%,0%_100%)] -translate-y-1/2"></div>
    </div>
  </div>
</template>

<style scoped>
@keyframes bounce-tooltip {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
.animate-bounce-tooltip {
  animation: bounce-tooltip 2s infinite;
}
</style>
