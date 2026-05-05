<script setup lang="ts">
import { ref } from 'vue';
import { Z_INDEX } from '@/constants/Layers';

defineProps<{
  mapShape?: string;
  type?: string;
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
  <button 
    v-if="mapShape && (type === 'roads' || type === 'roadsHideout')"
    ref="buttonRef"
    :class="['zone-button px-3 py-1.5 flex items-center gap-1.5 shadow-lg', Z_INDEX.CONTENT_LOW]"
    @click.stop="$emit('click')"
    @mousedown.stop
    title="Edit Handles"
  >
    <div class="w-2.5 h-2.5 rounded-full bg-gray-500 border border-white"></div>
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
  </button>
</template>
