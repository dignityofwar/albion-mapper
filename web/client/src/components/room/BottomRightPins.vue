<script setup lang="ts">
import { Z_INDEX } from '@/constants/Layers';

defineProps<{
  showDebug: boolean;
}>();

const emit = defineEmits<{
  (e: 'openDebug'): void;
  (e: 'openMobileSummary'): void;
  (e: 'fitView'): void;
}>();
</script>

<template>
  <!-- Fixed bottom-right: debug button + mobile summary button + landscape refresh -->
  <div class="fixed bottom-10 right-4 flex flex-col gap-4" :class="Z_INDEX.UI_OVERLAY">
    <!-- Desktop-only debug button -->
    <button
      v-if="showDebug"
      class="debug-btn w-12 h-12 flex items-center justify-center rounded-full frosted-button text-xl shadow-lg"
      title="Debug tray"
      @click="emit('openDebug')"
    >🐛</button>
    <!-- Landscape mobile: refresh button (shown via CSS) -->
    <div class="landscape-refresh hidden">
      <button
        class="w-12 h-12 flex items-center justify-center rounded-full frosted-button text-xl shadow-lg"
        title="Fit view"
        @click="emit('fitView')"
      >🔄</button>
    </div>
    <!-- Portrait mobile only: refresh button (hidden via CSS on landscape/desktop) -->
    <button
      class="portrait-refresh w-12 h-12 flex items-center justify-center rounded-full frosted-button text-xl shadow-lg"
      title="Fit view"
      @click="emit('fitView')"
    >🔄</button>
    <button
      class="summary-btn w-12 h-12 flex items-center justify-center rounded-full bg-indigo-600/70 backdrop-blur-md border border-indigo-400/60 text-xl shadow-lg md:hidden"
      title="Room Summary"
      @click="emit('openMobileSummary')"
    >
      <img src="/images/core-green.png" class="w-8 h-8 p-[2px]" alt="Green Core" />
    </button>
  </div>
</template>

<style scoped>
/* Hide the desktop debug button on landscape phones */
@media (max-width: 767px) and (max-height: 500px) {
  .debug-btn {
    display: none;
  }
}

/* Show landscape refresh row only on landscape phones */
@media (max-width: 767px) and (max-height: 500px) {
  .landscape-refresh {
    display: block;
  }
}

/* Hide portrait refresh on desktop and landscape phones */
@media (min-width: 768px) {
  .portrait-refresh {
    display: none;
  }
}
@media (max-height: 500px) {
  .portrait-refresh {
    display: none;
  }
}

/* Hide room summary button on desktop (md+) and landscape phones */
@media (min-width: 768px) {
  .summary-btn {
    display: none;
  }
}
@media (max-height: 500px) {
  .summary-btn {
    display: none;
  }
}
</style>
