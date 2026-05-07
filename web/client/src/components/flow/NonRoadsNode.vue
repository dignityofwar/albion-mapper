<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import { getHandlePosition, getBorderBgClass } from '@/utils/zoneStyles';
import { getHandleFacing } from 'shared';
import ZoneHeader from './zone/ZoneHeader.vue';
import { computed, ref, inject, type Ref } from 'vue';
import { connectionStyle } from '@/utils/connectionStyle';
import type { NodeFeatures } from 'shared';
import { useRoomStore } from '@/stores/useRoomStore';
import { deleteConnection } from '@/utils/roomOperations';
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
  proximityTo?: string;
}>>();

const store = useRoomStore();
const { isConnecting, connections } = storeToRefs(store);
const { updateNodeData } = useVueFlow();
const now = inject<Ref<number>>('globalNow', ref(Date.now()));
const isIsolated = computed(() => store.isNodeIsolated(props.id, now.value));
const isExpired = computed(() => store.isNodeExpired(props.id, now.value));
const isRestricted = computed(() => isIsolated.value || isExpired.value);
const hasReds = computed(() => !!props.data.features?.reds);

const hoveredHandleId = ref<string | null>(null);

const isPulsing = (handleId: string) => {
    return isConnecting.value &&
           (handleId === store.connectingSourceHandleId && props.id === store.connectingSourceNodeId || handleId === hoveredHandleId.value) &&
           handleId !== 'center-overlay';
};

const isIdle = (handleId: string) => {
    if (handleId === 'center-overlay') return false;
    if (isPulsing(handleId)) return false;

    if (isConnecting.value) return true;
    return handleId !== 'center';
};

const isActive = (handleId: string) => {
    if (handleId === 'center-overlay') return false;
    return isConnecting.value && !isPulsing(handleId);
};

const handleEdgeClass = (handleId: string): string => {
  if (handleId === 'center' || handleId === 'center-overlay') return '';
  const conn = connections.value.find(c =>
    (c.fromZoneId === props.id && c.fromHandleId === handleId) ||
    (c.toZoneId === props.id && c.toHandleId === handleId)
  );
  if (!conn) return '';
  const remainingMs = new Date(conn.expiresAt).getTime() - now.value;
  const style = connectionStyle(remainingMs, conn.isExpired ?? false);
  if (style.stroke === '#0ee25e') return 'handle-edge-green';
  if (style.stroke === '#f59e0b') return 'handle-edge-orange';
  if (style.stroke === '#ef4444') return 'handle-edge-red';
  return 'handle-edge-grey';
};

const { onConnectStart, onConnectEnd } = useVueFlow();

onConnectStart((params) => {
  store.isConnecting = true;
  const { handleId, nodeId } = params;
  if (handleId && nodeId) {
    store.connectingSourceHandleId = handleId;
    store.connectingSourceNodeId = nodeId;
  } else {
    store.connectingSourceHandleId = null;
    store.connectingSourceNodeId = null;
  }
});

onConnectEnd(() => {
  store.connectingSourceHandleId = null;
  store.connectingSourceNodeId = null;
  store.isConnecting = false;
});

const showDeleteOverlay = ref(false);

async function handleDelete() {
  try {
    const toDelete = new Set<string>();
    const queue = store.connections
      .filter(c => c.toZoneId === props.id)
      .map(c => c.id);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (toDelete.has(currentId)) continue;
      toDelete.add(currentId);
      const c = store.connections.find(x => x.id === currentId);
      if (c) {
        const children = store.connections.filter(x => x.fromZoneId === c.toZoneId);
        for (const child of children) queue.push(child.id);
      }
    }

    const toDeleteArray = Array.from(toDelete).reverse();
    for (const connId of toDeleteArray) {
      await deleteConnection(store.roomId, store.token, connId);
    }
  } catch (err) {
    console.error('Failed to delete node connections:', err);
  }
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
    <div :class="[isConnecting ? 'connecting-mode' : '']">
        <template v-for="handle in handles" :key="handle.id">
          <Handle
            type="source"
            :position="(handle.position ? handle.position : getHandlePosition(handle.left, handle.top)) as Position"
            :id="handle.id"
            :style="{ left: handle.left, top: handle.top }"
            :class="[
              'handle', 
              handle.id === 'center-overlay' ? Z_INDEX.HANDLE_OVERLAY : Z_INDEX.HANDLE,
              handle.id === 'center' || handle.id === 'center-overlay' ? 'center-handle' : '',
              handle.id === 'center-overlay' ? 'center-handle-snap' : '',
              handle.id !== 'center' && handle.id !== 'center-overlay' ? `facing-${getHandleFacing(handle.left, handle.top)}` : '',
              isIdle(handle.id) && !isConnecting ? 'handle-default' : '',
              isActive(handle.id) ? 'handle-active' : '',
              isPulsing(handle.id) ? 'pulsing-handle' : '',
              handleEdgeClass(handle.id)
            ]"
            @mouseenter="hoveredHandleId = handle.id === 'center-overlay' ? 'center' : handle.id"
            @mouseleave="(e: MouseEvent) => { if (!(e.relatedTarget as HTMLElement)?.closest?.('.vue-flow__handle')) hoveredHandleId = null }"
          />
        </template>
    </div>
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
      class="text-white text-xs text-center w-full h-full relative transition-all duration-300"
      :class="[
        hasReds ? 'red-glow' : '',
        props.data.isHome ? 'home-glow' : '',
        props.data.highlighted ? 'goto-glow-animation' : '',
        props.data.isGhost || isRestricted ? 'opacity-50 grayscale' : ''
      ]"
      @animationend="updateNodeData(props.id, { highlighted: false })"
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
      <div class="absolute inset-x-0 top-[45%] pointer-events-none flex flex-col items-center px-4" :class="Z_INDEX.CONTENT_LOW">
        <ZoneHeader
          :id="props.id" 
          :zone-name="props.data.zoneName" 
          :is-home="props.data.isHome" 
          :type="props.data.type as any" 
          :category="props.data.category"
          :map-shape="props.data.mapShape"
          :tier="props.data.tier"
          :proximity-to="props.data.proximityTo"
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
@import './nodes.css';

.non-roads-node {
  width: 200px;
  height: 200px;
}

.center-handle-snap {
  width: 80px !important;
  height: 80px !important;
  background-color: transparent !important;
  transform: translate(-50%, -50%) !important;
}
</style>
