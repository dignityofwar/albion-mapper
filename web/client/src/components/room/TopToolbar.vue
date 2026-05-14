<script setup lang="ts">
import { ref, computed } from 'vue';
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent, TooltipPortal } from 'reka-ui';
import ZoneSearchBar from '../ZoneSearchBar.vue';
import { Z_INDEX } from '@/constants/Layers';
import { useMediaQuery } from '@vueuse/core';

const props = defineProps<{
  nodes: any[];
  showDebug?: boolean;
  plotRouteMode?: boolean;
  hasRoute?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', nodeId: string): void;
  (e: 'fitView'): void;
  (e: 'openDebug'): void;
  (e: 'plotRoute'): void;
  (e: 'clearRoute'): void;
}>();

const searchActive = ref(false);
const isMobile = useMediaQuery('(max-width: 767px)');
const tooltipSide = computed(() => isMobile.value ? 'left' : 'bottom') as import('vue').ComputedRef<'left' | 'bottom'>;

function onPlotRouteClick() {
  if (props.plotRouteMode) {
    emit('clearRoute');
  } else if (props.hasRoute) {
    emit('clearRoute');
  } else {
    emit('plotRoute');
  }
}
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
    <TooltipProvider :delay-duration="0">
      <TooltipRoot>
        <TooltipTrigger as-child>
          <button
            class="fit-view-btn w-10 h-10 items-center justify-center rounded-full frosted-button text-lg shadow-lg transition-colors flex-shrink-0"
            @click="emit('fitView')"
          >🔄</button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent
            class="bg-black/90 text-white text-xs px-2 py-1 rounded shadow-lg z-[10000]"
            :side="tooltipSide"
          >Fit view</TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>

    <!-- Plot Route button -->
    <TooltipProvider :delay-duration="0">
      <TooltipRoot>
        <TooltipTrigger as-child>
          <button
            class="plot-route-btn w-10 h-10 items-center justify-center rounded-full text-lg shadow-lg transition-colors flex-shrink-0"
            :class="plotRouteMode ? 'bg-blue-600 text-white ring-2 ring-blue-300' : (hasRoute ? 'plot-route-active-pulse text-blue-300' : 'frosted-button')"
            @click="onPlotRouteClick"
          >🗺️</button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent
            class="bg-black/90 text-white text-xs px-2 py-1 rounded shadow-lg z-[10000]"
            :side="tooltipSide"
          >{{ plotRouteMode ? 'Cancel route plotting (Esc)' : (hasRoute ? 'Clear plotted route' : 'Plot route to zone') }}</TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>

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

/* Plot route button: hidden on portrait mobile (shown in bottom-right there), visible elsewhere */
.plot-route-btn {
  display: none;
}
@media (min-width: 768px) and (min-height: 501px) {
  .plot-route-btn {
    display: flex;
  }
}
@media (max-width: 1200px) and (max-height: 500px) {
  .plot-route-btn {
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

@keyframes plot-route-pulse {
  0%, 100% { background-color: rgba(30, 58, 138, 0.7); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
  50% { background-color: rgba(37, 99, 235, 0.85); box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); }
}

.plot-route-active-pulse {
  animation: plot-route-pulse 2s infinite ease-in-out;
  border: 1px solid #3b82f6;
}
</style>
