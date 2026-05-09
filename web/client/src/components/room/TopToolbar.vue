<script setup lang="ts">
import { ref } from 'vue';
import ZoneSearchBar from '../ZoneSearchBar.vue';
import { Z_INDEX } from '@/constants/Layers';

defineProps<{
  nodes: any[];
  showDebug?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', nodeId: string): void;
  (e: 'fitView'): void;
  (e: 'openDebug'): void;
}>();

const searchActive = ref(false);
</script>

<template>
  <!-- Search bar + fit-view button: centred on desktop/portrait, right-aligned on landscape mobile -->
  <div
    class="toolbar-wrap absolute flex items-center gap-2"
    :class="searchActive ? Z_INDEX.SEARCH_ACTIVE : Z_INDEX.UI_OVERLAY"
  >
    <!-- Landscape mobile: debug button left of fit-view -->
    <button
      v-if="showDebug"
      class="landscape-debug w-10 h-10 items-center justify-center rounded-full frosted-button text-lg shadow-lg flex-shrink-0"
      title="Debug tray"
      @click="emit('openDebug')"
    >🐛</button>
    <!-- Fit-view button: left of search on desktop + landscape mobile -->
    <button
      class="fit-view-btn w-10 h-10 items-center justify-center rounded-full frosted-button text-lg shadow-lg transition-colors flex-shrink-0"
      title="Fit view"
      @click="emit('fitView')"
    >🔄</button>
    <ZoneSearchBar :nodes="nodes" @select="emit('select', $event)" @search-active="searchActive = $event" />
  </div>
</template>

<style scoped>
/* Default (portrait mobile): centred */
.toolbar-wrap {
  top: 3.5rem;
  left: 50%;
  transform: translateX(-50%);
}
/* Desktop: centred */
@media (min-width: 768px) {
  .toolbar-wrap {
    top: 0.5rem;
    transform: translateX(-50%);
  }
}
/* Landscape mobile: right-aligned */
@media (max-width: 1200px) and (max-height: 500px) {
  .toolbar-wrap {
    top: 0.5rem;
    transform: none;
    left: inherit;
    right: 1rem;
  }
}

/* Fit-view button: hidden on portrait mobile, shown on desktop + landscape mobile */
.fit-view-btn {
  display: none;
}
@media (min-width: 768px) and (min-height: 501px) {
  .fit-view-btn {
    display: flex;
  }
}
/* Landscape debug button: hidden by default, shown on landscape phones */
.landscape-debug {
  display: none;
}
@media (max-width: 767px) and (max-height: 500px) {
  .landscape-debug {
    display: flex;
  }
}
</style>
