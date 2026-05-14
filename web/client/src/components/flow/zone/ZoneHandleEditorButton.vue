<script setup lang="ts">
import { ref } from 'vue';
import { Z_INDEX } from '@/constants/Layers';

defineProps<{
  mapShape?: string;
  type?: string;
  hasReds?: boolean;
  needsCustomHandles?: boolean;
}>();

defineEmits<{
  (e: 'click'): void;
}>();

const buttonRef = ref<HTMLButtonElement | null>(null);

defineExpose({
  $el: buttonRef
});
</script>

<template>
  <div class="relative flex items-center">
    <!-- Floating Element -->
    <div v-if="needsCustomHandles" class="absolute right-full mr-2 whitespace-nowrap bg-blue-600 border border-blue-400 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none z-[10000]">
      Set Portal Positions!
    </div>
    
    <button 
      v-if="mapShape && (type === 'roads' || type === 'roadsHideout')"
      ref="buttonRef"
      :class="[
        'zone-button px-3 py-1.5 flex items-center gap-1.5 shadow-lg pointer-events-auto', 
        hasReds ? 'zone-button-reds' : '', 
        needsCustomHandles ? 'pulsing-button' : '',
        Z_INDEX.CONTENT_LOW
      ]"
      @click.stop="$emit('click')"
    >
      <div class="mini-handle pointer-events-none"></div>
      <svg class="pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
    </button>
  </div>
</template>

<style scoped>
@keyframes pulse-prompt {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4);
    border-color: rgba(255, 255, 255, 0.5);
  }
  50% {
    box-shadow: 0 0 8px 2px rgb(0 132 191 / 0.7);
    border-color: rgb(0 166 255);
    background-color: #1d4ed8;
  }
}

.pulsing-button {
  animation: pulse-prompt 2s ease-in-out infinite;
}

.mini-handle {
  width: 16px;
  height: 8px;
  background-color: rgb(87 87 87 / 0.42);
  border: 1px solid #919191;
  border-bottom: none;
  border-radius: 16px 16px 0 0;
  box-sizing: border-box;
}
</style>
