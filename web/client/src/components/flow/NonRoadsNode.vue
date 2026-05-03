<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import { getHandlePosition, getBorderBgClass } from '@/utils/zoneStyles';
import ZoneHeader from './zone/ZoneHeader.vue';
import { computed, ref, inject, type Ref } from 'vue';
import type { NodeFeatures } from 'shared';
import { useRoomStore } from '@/stores/useRoomStore';
import { Z_INDEX } from '@/constants/Layers';
import { storeToRefs } from 'pinia';

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
const { isConnecting } = storeToRefs(store);
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

const handles = computed(() => {
  const h = [
    { id: 'center', left: '50%', top: '50%', position: Position.Right }
  ];
  
  // Add overlay handle if connecting to allow for easy center snapping
  if (isConnecting.value) {
    h.push({ id: 'center-overlay', left: '50%', top: '50%', position: Position.Right });
  }

  return h;
});
</script>

<template>
  <div class="non-roads-node relative" :class="{ 'ghost-node': props.data.isGhost }">
    <template v-for="handle in handles" :key="handle.id">
      <Handle
        type="source"
        :position="(handle.position ? handle.position : getHandlePosition(handle.left, handle.top)) as Position"
        :id="handle.id"
        :style="{ left: handle.left, top: handle.top }"
        :class="[
          'custom-handle', 
          handle.id === 'center-overlay' ? Z_INDEX.HANDLE_OVERLAY : Z_INDEX.HANDLE,
          handle.id === 'center' || handle.id === 'center-overlay' ? 'center-handle' : '',
          handle.id === 'center-overlay' ? 'center-handle-snap' : ''
        ]"
      />
    </template>
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
  width: 150px;
  height: 150px;
}

.custom-handle {
  transform: translate(-50%, -50%) !important;
  width: 30px !important;
  height: 30px !important;
  pointer-events: auto !important;
  border: none !important;
  border-radius: 50% !important;
  background-color: #b6b6b6 !important;
  box-sizing: border-box !important;
}

.center-handle {
  width: 1px !important;
  height: 1px !important;
  background-color: transparent !important;
}

.center-handle-snap {
  width: 110px !important;
  height: 110px !important;
  background-color: transparent !important;
}
</style>
