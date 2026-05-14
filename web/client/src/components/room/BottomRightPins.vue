<script setup lang="ts">
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent, TooltipPortal } from 'reka-ui';
import { Z_INDEX } from '@/constants/Layers';

defineProps<{
  showDebug: boolean;
  plotRouteMode?: boolean;
  hasRoute?: boolean;
}>();

const emit = defineEmits<{
  (e: 'openDebug'): void;
  (e: 'openMobileSummary'): void;
  (e: 'fitView'): void;
  (e: 'plotRoute'): void;
  (e: 'clearRoute'): void;
}>();

function onPlotRouteClick(plotRouteMode?: boolean, hasRoute?: boolean) {
  if (plotRouteMode || hasRoute) {
    emit('clearRoute');
  } else {
    emit('plotRoute');
  }
}
</script>

<template>
  <!-- Fixed bottom-right: debug button + mobile summary button + landscape refresh -->
  <div class="fixed bottom-10 right-4 flex flex-col gap-4" :class="Z_INDEX.UI_OVERLAY">
    <!-- Desktop-only debug button -->
    <TooltipProvider :delay-duration="0">
      <TooltipRoot>
        <TooltipTrigger as-child>
          <button
            v-if="showDebug"
            class="debug-btn w-12 h-12 flex items-center justify-center rounded-full frosted-button text-xl shadow-lg"
            @click="emit('openDebug')"
          >🐛</button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent class="bg-black/90 text-white text-xs px-2 py-1 rounded shadow-lg z-[10000]" side="left">Debug tray</TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
    <!-- Landscape mobile: refresh button (shown via CSS) -->
    <div class="landscape-refresh hidden">
      <TooltipProvider :delay-duration="0">
        <TooltipRoot>
          <TooltipTrigger as-child>
            <button
              class="w-12 h-12 flex items-center justify-center rounded-full frosted-button text-xl shadow-lg"
              @click="emit('fitView')"
            >🔄</button>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent class="bg-black/90 text-white text-xs px-2 py-1 rounded shadow-lg z-[10000]" side="left">Fit view</TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
      </TooltipProvider>
    </div>
    <!-- Portrait mobile only: refresh button (hidden via CSS on landscape/desktop) -->
    <TooltipProvider :delay-duration="0">
      <TooltipRoot>
        <TooltipTrigger as-child>
          <button
            class="portrait-refresh w-12 h-12 flex items-center justify-center rounded-full frosted-button text-xl shadow-lg"
            @click="emit('fitView')"
          >🔄</button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent class="bg-black/90 text-white text-xs px-2 py-1 rounded shadow-lg z-[10000]" side="left">Fit view</TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
    <!-- Portrait mobile only: plot route button -->
    <TooltipProvider :delay-duration="0">
      <TooltipRoot>
        <TooltipTrigger as-child>
          <button
            class="portrait-plot-route w-12 h-12 flex items-center justify-center rounded-full text-xl shadow-lg transition-colors"
            :class="plotRouteMode ? 'bg-blue-600 text-white ring-2 ring-blue-300' : (hasRoute ? 'plot-route-active-pulse text-blue-300' : 'frosted-button')"
            @click="onPlotRouteClick(plotRouteMode, hasRoute)"
          >🗺️</button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent class="bg-black/90 text-white text-xs px-2 py-1 rounded shadow-lg z-[10000]" side="left">{{ plotRouteMode ? 'Cancel route plotting (Esc)' : (hasRoute ? 'Clear plotted route' : 'Plot route to zone') }}</TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
    <TooltipProvider :delay-duration="0">
      <TooltipRoot>
        <TooltipTrigger as-child>
          <button
            class="summary-btn w-12 h-12 flex items-center justify-center rounded-full bg-indigo-600/70 backdrop-blur-md border border-indigo-400/60 text-xl shadow-lg"
            @click="emit('openMobileSummary')"
          >
            <img src="/images/core-green.png" class="w-8 h-8 p-[2px]" alt="Green Core" />
          </button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent class="bg-black/90 text-white text-xs px-2 py-1 rounded shadow-lg z-[10000]" side="left">Room Summary</TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
  </div>
</template>

<style scoped>
/* Hide the desktop debug button on landscape phones */
@media (max-width: 767px) and (max-height: 500px) {
  .debug-btn {
    display: none;
  }
}

/* Show landscape refresh row on any short screen (height ≤ 500px) */
@media (max-height: 500px) {
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

/* Portrait mobile plot route button: only on portrait mobile */
@media (min-width: 768px) {
  .portrait-plot-route {
    display: none;
  }
}
@media (max-height: 500px) {
  .portrait-plot-route {
    display: none;
  }
}

/* Show summary button on portrait mobile OR short screens (trays hidden); hide on tall desktop */
@media (min-width: 768px) and (min-height: 501px) {
  .summary-btn {
    display: none;
  }
}

@keyframes plot-route-pulse {
  0%, 100% { background-color: rgba(30, 58, 138, 0.7); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
  50% { background-color: rgba(37, 99, 235, 0.85); box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); }
}

.plot-route-active-pulse {
  animation: plot-route-pulse 1.5s infinite ease-in-out;
  border: 1px solid #3b82f6;
}
</style>
