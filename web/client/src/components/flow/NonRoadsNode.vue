<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import { DEFAULT_INTERNAL_HANDLES } from 'shared';
import { getHandlePosition, getBorderBgClass } from '@/utils/zoneStyles';
import ZoneHeader from './zone/ZoneHeader.vue';
import { computed, inject, ref } from 'vue';
import type { NodeFeatures } from 'shared';
import { storeToRefs } from 'pinia';
import { useRoomStore } from '@/stores/useRoomStore';

const props = defineProps<NodeProps<{ 
  isHome: boolean; 
  tier: number; 
  zoneName: string; 
  type: string; 
  category?: string;
  highlighted?: boolean;
  mapShape?: string;
  isGhost?: boolean;
  features?: NodeFeatures;
}>>();

const store = useRoomStore();
const isIsolated = computed(() => store.isNodeIsolated?.(props.id) ?? false);
const isExpired = computed(() => store.isNodeExpired?.(props.id) ?? false);
const isRestricted = computed(() => isIsolated.value || isExpired.value);
const hasReds = computed(() => !!props.data.features?.reds);

const defaultInternalHandles = computed(() => {
  return DEFAULT_INTERNAL_HANDLES.map(h => ({
    ...h,
    position: getHandlePosition(h.left, h.top),
  }));
});
</script>

<template>
  <div class="non-roads-node" :class="{ 'opacity-50 grayscale pointer-events-none': props.data.isGhost || isRestricted }">
    <div 
      class="text-white text-xs text-center w-[150px] h-[150px] relative transition-all duration-300"
      :class="[
        hasReds ? 'red-glow' : '',
        props.data.isHome ? 'home-glow' : '',
        props.data.highlighted ? 'goto-glow' : ''
      ]"
    >
      <!-- Smaller Diamond Shape Background -->
      <div 
        class="absolute inset-0 diamond-shape transition-colors duration-300 pointer-events-none z-[5]"
        :class="[hasReds ? 'bg-red-500' : getBorderBgClass(props.data.type)]"
      ></div>
      <div 
        class="absolute inset-[2px] diamond-shape transition-colors duration-300 pointer-events-none z-[6]"
        :class="[hasReds ? 'bg-red-950' : 'bg-gray-800']"
      ></div>

      <!-- Central Content Block -->
      <div class="absolute inset-x-0 top-[35%] z-10 pointer-events-none flex flex-col items-center px-4">
        <ZoneHeader
          :id="props.id" 
          :zone-name="props.data.zoneName" 
          :is-home="props.data.isHome" 
          :type="props.data.type as any" 
          :category="props.data.category"
          :map-shape="props.data.mapShape"
          :tier="props.data.tier"
          compact
        />
      </div>

      <!-- Hidden Handles -->
      <div class="absolute inset-0 pointer-events-none">
        <Handle
          v-for="h in defaultInternalHandles"
          :key="h.id"
          :id="h.id"
          type="source"
          :position="h.position"
          :style="{ left: h.left, top: h.top, opacity: 0, pointerEvents: 'auto' }"
          :class="['z-30', isRestricted ? 'grayscale' : '']"
          :connectable="!isRestricted"
        />
        <Handle
          v-for="h in defaultInternalHandles"
          :key="h.id"
          :id="h.id"
          type="target"
          :position="h.position"
          :style="{ left: h.left, top: h.top, opacity: 0, pointerEvents: 'auto' }"
          :class="['z-30', isRestricted ? 'grayscale' : '']"
          :connectable="!isRestricted"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.diamond-shape {
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
}

.goto-glow {
  filter: drop-shadow(0 0 15px rgba(234, 179, 8, 0.6));
}

.red-glow {
  filter: drop-shadow(0 0 15px rgba(239, 68, 68, 0.7));
  animation: slow-glow 3s infinite ease-in-out;
}

.home-glow {
  filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));
}

@keyframes slow-glow {
  0%, 100% {
    filter: drop-shadow(0 0 15px rgba(239, 68, 68, 0.3));
  }
  50% {
    filter: drop-shadow(0 0 25px rgba(239, 68, 68, 0.8));
  }
}

.non-roads-node {
  /* Smaller than the 400px default */
  width: 200px;
  height: 200px;
}
</style>
