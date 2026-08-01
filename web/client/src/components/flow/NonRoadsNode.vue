<script setup lang="ts">
import { Position, useVueFlow } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import { getBorderBgClass } from '@/utils/zoneStyles';
import ZoneNodeHandles from './ZoneNodeHandles.vue';
import ZoneHeader from './zone/ZoneHeader.vue';
import { computed, ref, inject, type Ref, watch } from 'vue';
import type { NodeFeatures } from 'shared';
import { useRoomStore } from '@/stores/useRoomStore';
import { usePlotRouteStore } from '@/stores/usePlotRouteStore';
import type { CustomHandle } from 'shared';
import { deleteConnections, deleteNode } from '@/utils/roomOperations';
import { Z_INDEX } from '@/constants/Layers';
import { storeToRefs } from 'pinia';
import { TooltipProvider } from 'reka-ui';
import ChainIdPill from '@/components/common/ChainIdPill.vue';
import PingButton from './zone/PingButton.vue';

const props = defineProps<NodeProps<{ 
  isChainSource: boolean;
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
const plotRouteStore = usePlotRouteStore();
const { isConnecting, nodePositions } = storeToRefs(store);
const { updateNodeData } = useVueFlow();
const now = inject<Ref<number>>('globalNow', ref(Date.now()));

const isPinged = ref(false);
const pingKey = ref(0);
const isHovered = ref(false);
const isPlotRouteTarget = computed(() => plotRouteStore.isPlotRouteMode && !props.data.isGhost && isHovered.value);
const isRouteDestination = computed(() => (plotRouteStore.fromZoneId === props.id || plotRouteStore.toZoneId === props.id) && plotRouteStore.hasRoute);
// During selectingTo: the chosen start zone should glow blue even before the route is committed
const isSelectingFromZone = computed(() => plotRouteStore.isSelectingTo && plotRouteStore.fromZoneId === props.id);
// During selectingTo: zones not in the selected chain should be dimmed
const thisNodeChainId = computed(() => nodePositions.value.find(n => n.zoneId === props.id)?.chainId ?? null);
const isGreyedByChain = computed(() =>
  plotRouteStore.isSelectingTo &&
  !props.data.isGhost &&
  thisNodeChainId.value !== plotRouteStore.chainId
);

function handlePing() {
  store.send({ type: 'ping', zoneName: props.data.zoneName || props.id, nodeId: props.id });
}

watch(() => store.lastPing, (ping) => {
  if (ping && ping.nodeId === props.id) {
    isPinged.value = false;
    pingKey.value++;
    requestAnimationFrame(() => {
      isPinged.value = true;
    });
  }
});
const isIsolated = computed(() => store.isNodeIsolated(props.id, now.value));
const isExpired = computed(() => store.isNodeExpired(props.id, now.value));
const isRestricted = computed(() => isIsolated.value || isExpired.value);
const hasReds = computed(() => !!props.data.features?.reds);

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

    // One request for the whole branch; the server drops any zone the removal
    // orphans, so only a surviving position still needs an explicit delete.
    const removed = toDelete.size > 0
      ? await deleteConnections(store.roomId, store.token, Array.from(toDelete).reverse())
      : null;
    if (!(removed?.removedZoneIds ?? []).includes(props.id)) {
      await deleteNode(store.roomId, store.token, props.id);
    }
    plotRouteStore.onNodeRemoved(props.id);
  } catch (err) {
    console.error('Failed to delete node connections:', err);
  }
  showDeleteOverlay.value = false;
}

const handles = computed<CustomHandle[]>(() => {
  const h: CustomHandle[] = [
    { id: 'center', left: '50%', top: '50%', position: Position.Right },
    // Fixed handles at the midpoints of each of the diamond's four edges
    // (i.e. the four "corners" of the bounding square). These are static —
    // they cannot be moved by the user.
    { id: 'nw', left: '25%', top: '25%', position: Position.Top },
    { id: 'ne', left: '75%', top: '25%', position: Position.Top },
    { id: 'se', left: '75%', top: '75%', position: Position.Bottom },
    { id: 'sw', left: '25%', top: '75%', position: Position.Bottom },
  ];

  // Hide this node's own center handle while dragging a connection from it,
  // so the source zone doesn't show a center snap target on itself.
  const isSource = isConnecting.value && store.connectingSourceNodeId === props.id;

  // Add overlay handle if connecting to allow for easy center snapping
  if (isConnecting.value && !isSource) {
    h.push({ id: 'center-overlay', left: '50%', top: '50%', position: Position.Right });
  }

  return isSource ? h.filter(x => x.id !== 'center') : h;
});
</script>

<template>
  <div class="non-roads-node relative" :class="{ 'ghost-node': props.data.isGhost }">
    <ChainIdPill :zone-id="props.id" :position-style="{  'z-index': '30' }" />
    <div :class="[isConnecting ? 'connecting-mode' : '']">
        <ZoneNodeHandles
          :node-id="props.id"
          :node-type="props.data.type"
          :handles="handles"
          :is-restricted="isRestricted"
          :now="now"
        />
    </div>
    <!-- Plot route mode overlay: intercepts clicks on inner elements so only the node-level click registers.
         We drive isHovered from here so the glow activates even though this div sits on top of the inner content. -->
    <div
      v-if="plotRouteStore.isPlotRouteMode && !props.data.isGhost"
      class="absolute inset-0 z-[200] cursor-pointer"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    />

    <div v-if="isRestricted" class="absolute inset-0 cursor-pointer" :class="[Z_INDEX.RESTRICTED_NODE, { 'bg-transparent': !showDeleteOverlay, 'bg-black/80': showDeleteOverlay }]" @click="showDeleteOverlay = true">
       <div v-if="showDeleteOverlay" class="flex flex-col items-center justify-center h-full rounded-lg" @click.stop>
         <p class="text-white mb-4">Node is expired. Delete it?</p>
         <div class="flex gap-2">
           <button @click.stop="handleDelete" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">Delete</button>
           <button @click.stop="showDeleteOverlay = false" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded">Cancel</button>
         </div>
       </div>
    </div>
    <TooltipProvider :delay-duration="0">
    <div
      :key="pingKey"
      class="text-white text-xs text-center w-full h-full relative transition-all duration-300"
      :class="[
        hasReds ? 'red-glow' : '',
        props.data.highlighted ? 'goto-glow-animation' : '',
        isPinged ? 'ping-animation' : '',
        props.data.isGhost || isRestricted ? 'opacity-50 grayscale' : '',
        isGreyedByChain ? 'opacity-30 grayscale' : '',
        isPlotRouteTarget && store.animationsEnabled ? 'plot-route-hover' : (isPlotRouteTarget ? 'plot-route-hover-static' : ''),
        (isRouteDestination || isSelectingFromZone) && store.animationsEnabled ? 'plot-route-destination' : ((isRouteDestination || isSelectingFromZone) ? 'plot-route-destination-static' : '')
      ]"
      @animationend="(e: AnimationEvent) => { if (e.animationName === 'goto-glow') updateNodeData(props.id, { highlighted: false }); if (e.animationName === 'ping-glow' || e.animationName === 'ping-glow-home') isPinged = false; }"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    >
      <!-- Ping Button (top tip) -->
      <div class="absolute left-1/2 -translate-x-1/2 top-9" :class="Z_INDEX.CONTENT_LOW">
        <PingButton @ping="handlePing" />
      </div>

      <!-- Smaller Diamond Shape Background -->
      <div 
        class="absolute inset-0 diamond-shape transition-colors duration-300 pointer-events-none"
        :class="[hasReds ? 'bg-red-500' : (props.data.isChainSource ? 'bg-green-500' : (props.data.zoneName === 'Brecilien' ? 'bg-purple-500 border-purple-200' : getBorderBgClass(props.data.type))), Z_INDEX.NODE_BASE]"
      ></div>
      <div 
        class="absolute inset-[4px] diamond-shape transition-colors duration-300 pointer-events-none"
        :class="[hasReds ? 'bg-red-950' : 'bg-gray-800', Z_INDEX.NODE_BORDER]"
      ></div>

      <!-- Central Content Block -->
      <div class="absolute inset-x-0 top-[40%] pointer-events-none flex flex-col items-center px-4" :class="Z_INDEX.CONTENT_LOW">
        <ZoneHeader
          :id="props.id" 
          :zone-name="props.data.zoneName" 
          :is-chain-source="props.data.isChainSource" 
          icon-compact
          :type="props.data.type as any" 
          :category="props.data.category"
          :map-shape="props.data.mapShape"
          :tier="props.data.tier"
          :proximity-to="props.data.proximityTo"
        />
      </div>

      <!-- Hidden Handles -->
      <div class="absolute inset-0 pointer-events-none">
      </div>
    </div>
    </TooltipProvider>
  </div>
</template>

<style scoped>
@import './nodes.css';

.non-roads-node {
  width: 250px;
  height: 250px;
}

.plot-route-hover {
  animation: plot-route-hover-pulse 1.5s ease-in-out infinite;
}

.plot-route-hover-static {
  filter: drop-shadow(0 0 18px #60a5fa) drop-shadow(0 0 6px #93c5fd);
}

@keyframes plot-route-hover-pulse {
  0%, 100% { filter: drop-shadow(0 0 18px #60a5fa) drop-shadow(0 0 6px #93c5fd); }
  50% { filter: drop-shadow(0 0 6px #1d4ed8) drop-shadow(0 0 2px #3b82f6); }
}

.plot-route-destination {
  animation: plot-route-destination-pulse 5s ease-in-out infinite;
}

.plot-route-destination-static {
  filter: drop-shadow(0 0 20px #1d4ed8) drop-shadow(0 0 8px #1e40af);
}

@keyframes plot-route-destination-pulse {
  0%, 100% { filter: drop-shadow(0 0 20px #1d4ed8) drop-shadow(0 0 8px #1e40af); }
  50% { filter: drop-shadow(0 0 8px #1e3a8a) drop-shadow(0 0 2px #1d4ed8); }
}
</style>
