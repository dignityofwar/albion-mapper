<script setup lang="ts">
import { Handle } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import { DEFAULT_INTERNAL_HANDLES } from 'shared';
import { getHandlePosition, getBorderBgClass } from '@/utils/zoneStyles';
import ZoneHeader from './zone/ZoneHeader.vue';
import { computed, ref, inject, type Ref } from 'vue';
import type { NodeFeatures } from 'shared';
import { useRoomStore } from '@/stores/useRoomStore';
import { Z_INDEX } from '@/constants/Layers';

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
const now = inject<Ref<number>>('globalNow', ref(Date.now()));
const isIsolated = computed(() => store.isNodeIsolated(props.id, now.value));
const isExpired = computed(() => store.isNodeExpired(props.id, now.value));
const isRestricted = computed(() => isIsolated.value || isExpired.value);
const hasReds = computed(() => !!props.data.features?.reds);

const showDeleteOverlay = ref(false);

function handleDelete() {
  const newPositions = store.nodePositions.filter(n => n.zoneId !== props.id);
  store.updateNodePositionsInStore(newPositions);
  showDeleteOverlay.value = false;
}

const defaultInternalHandles = computed(() => {
  return DEFAULT_INTERNAL_HANDLES.map(h => ({
    ...h,
    position: getHandlePosition(h.left, h.top),
  }));
});
</script>

<template>
  <div class="non-roads-node relative" :class="{ 'ghost-node': props.data.isGhost }">
    <div v-if="isRestricted" class="absolute inset-0 cursor-pointer" :class="[Z_INDEX.RESTRICTED_NODE, { 'bg-transparent': !showDeleteOverlay, 'bg-black/80': showDeleteOverlay }]" @click="showDeleteOverlay = true">
       <div v-if="showDeleteOverlay" class="flex flex-col items-center justify-center h-full rounded-lg" @click.stop>
         <p class="text-white mb-4">Node is expired. Delete it?</p>
         <div class="flex gap-2">
           <button @click.stop="handleDelete" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">Delete</button>
           <button @click.stop="showDeleteOverlay = false" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded">Cancel</button>
         </div>
       </div>
    </div>
    <div 
      class="text-white text-xs text-center w-[150px] h-[150px] relative transition-all duration-300"
      :class="[
        hasReds ? 'red-glow' : '',
        props.data.isHome ? 'home-glow' : '',
        props.data.highlighted ? 'goto-glow' : '',
        props.data.isGhost || isRestricted ? 'opacity-50 grayscale' : ''
      ]"
    >
      <!-- Smaller Diamond Shape Background -->
      <div 
        class="absolute inset-0 diamond-shape transition-colors duration-300 pointer-events-none"
        :class="[hasReds ? 'bg-red-500' : getBorderBgClass(props.data.type), Z_INDEX.NODE_BASE]"
      ></div>
      <div 
        class="absolute inset-[2px] diamond-shape transition-colors duration-300 pointer-events-none"
        :class="[hasReds ? 'bg-red-950' : 'bg-gray-800', Z_INDEX.NODE_BORDER]"
      ></div>

      <!-- Central Content Block -->
      <div class="absolute inset-x-0 top-[35%] pointer-events-none flex flex-col items-center px-4" :class="Z_INDEX.CONTENT_LOW">
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
          :class="[Z_INDEX.HANDLE, isRestricted ? 'grayscale' : '']"
          :connectable="!isRestricted"
        />
        <Handle
          v-for="h in defaultInternalHandles"
          :key="h.id"
          :id="h.id"
          type="target"
          :position="h.position"
          :style="{ left: h.left, top: h.top, opacity: 0, pointerEvents: 'auto' }"
          :class="[Z_INDEX.HANDLE, isRestricted ? 'grayscale' : '']"
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
