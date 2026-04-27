<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, watchEffect, nextTick, markRaw, provide } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useRoomStore } from '@/stores/useRoomStore';
import ReportForm from '../components/ReportForm.vue';
import DebugTray from '../components/DebugTray.vue';
import ZoneNode from '../components/flow/ZoneNode.vue';
import ConnectionEdge from '../components/flow/ConnectionEdge.vue';
import { VueFlow, useVueFlow, ConnectionMode, type Node, type Edge, type OnConnectStartParams } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { formatTime, formatExpiresIn } from '../utils/formatters.js';
import { setHomeZone, deleteConnection, updateConnection } from '../utils/roomOperations.js';
import { connectionStyle } from '../utils/connectionStyle.js';
import { ZONE_BY_ID, type Connection, type NodePosition, type NodeFeatures } from 'shared';

const props = defineProps<{ id: string }>();
const store = useRoomStore();
const { connections, homeZoneId, nodePositions, lastUpdate } = storeToRefs(store);
const router = useRouter();

// ── Toast ────────────────────────────────────────────────────────────────────
const toast = ref('');
const lastUpdateFlash = ref(false);
let flashTimeout: ReturnType<typeof setTimeout> | null = null;
const initialUpdateCount = ref(0);

// Flash animation whenever lastUpdate changes
watch(
  () => lastUpdate.value?.getTime(),
  async () => {
    if (initialUpdateCount.value < 2) {
      initialUpdateCount.value++;
      return;
    }
    lastUpdateFlash.value = false;
    if (flashTimeout) clearTimeout(flashTimeout);
    await nextTick();
    flashTimeout = setTimeout(() => {
      lastUpdateFlash.value = true;
      flashTimeout = setTimeout(() => (lastUpdateFlash.value = false), 2000);
    }, 50);
  },
);

onMounted(() => {
  initializeRoom();
});

watch(() => props.id, () => {
  store.disconnect();
  initializeRoom();
});

function initializeRoom() {
  const stored = sessionStorage.getItem(`token:${props.id}`);
  if (!stored) {
    router.replace({ path: `/rooms/${props.id}/auth` });
    return;
  }
  store.setCredentials(props.id, stored);
  store.connect();
  const shareUrl = sessionStorage.getItem(`shareUrl:${props.id}`);
  if (shareUrl) {
    showToast(`Share URL: ${shareUrl}`);
    sessionStorage.removeItem(`shareUrl:${props.id}`);
  }
}

// ── Toast (kept below) ───────────────────────────────────────────────────────
let toastTimeout: ReturnType<typeof setTimeout> | null = null;
const isShareUrl = computed(() => toast.value.startsWith('Share URL: '));
const shareUrl = computed(() => toast.value.replace('Share URL: ', ''));

async function copyShareUrl() {
  await navigator.clipboard.writeText(shareUrl.value);
  showToast('Copied to clipboard!');
}

function showToast(msg: string) {
  toast.value = msg;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => (toast.value = ''), 5000);
}

// ── Countdown ticker ─────────────────────────────────────────────────────────
const now = ref(Date.now());
const ticker = setInterval(() => (now.value = Date.now()), 1000);
onUnmounted(() => {
  clearInterval(ticker);
  store.disconnect();
  if (toastTimeout) clearTimeout(toastTimeout);
  if (flashTimeout) clearTimeout(flashTimeout);
});


// ── Vue Flow nodes/edges ──────────────────────────────────────────────────────
const { fitView, updateNode } = useVueFlow();
const openPopoverId = ref<string | null>(null);
provide('openPopoverId', openPopoverId);

const flowNodes = ref<Node[]>([]);
const flowEdges = ref<Edge[]>([]);
const isSkippingAutoLayout = ref(false);
let wasConnected = false;
let draggingFromNodeId: string | null = null;

function getEdgeParams(conn: Connection, currentTime: number) {
  const expiresAt = new Date(conn.expiresAt).getTime();
  const remainingMs = expiresAt - currentTime;
  const isStale = remainingMs < 0 && remainingMs > -6 * 60 * 60 * 1000;
  const style = connectionStyle(remainingMs, isStale, conn.isExpired ?? false);
  if (conn.isExpired) {
    style.animated = false;
  }
  return { remainingMs, isStale, style };
}

function computeHandles(sourceNode: any, targetNode: any) {
  const dx = targetNode.position.x - sourceNode.position.x;
  const dy = targetNode.position.y - sourceNode.position.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      sourceHandle: dx > 0 ? 'right' : 'left',
      targetHandle: dx > 0 ? 'left' : 'right',
    };
  } else {
    return {
      sourceHandle: dy > 0 ? 'bottom' : 'top',
      targetHandle: dy > 0 ? 'top' : 'bottom',
    };
  }
}

watch([homeZoneId, nodePositions, connections], (newVal, oldVal) => {
    if (!homeZoneId.value) return;

    const newConnections = connections.value;
    const oldConnections = oldVal ? oldVal[2] as Connection[] : [];
    const existingNodeIds = new Set(nodePositions.value.map(np => np.zoneId));

    // Find new connections
    const addedConnections = newConnections.filter(c => !oldConnections.find(oc => oc.id === c.id));
        
    // 1. Compute positions
    let positions: NodePosition[] = [...nodePositions.value];
    let hasNewNodes = false;

    for (const conn of addedConnections) {
        let newNodeId = null;
        let parentNodeId = null;

        // Find anchor node (prefer source)
        if (existingNodeIds.has(conn.fromZoneId)) {
            if (!existingNodeIds.has(conn.toZoneId)) {
                newNodeId = conn.toZoneId;
                parentNodeId = conn.fromZoneId; // Anchor to Source
            }
        } else if (existingNodeIds.has(conn.toZoneId)) {
            // Source is not in graph! This is the problematic case.
            // But let's see if we can do something else.
            newNodeId = conn.fromZoneId;
            parentNodeId = conn.toZoneId; // Anchor to Target (as fallback)
        }

        if (newNodeId && parentNodeId) {
            const parentPos = positions.find(np => np.zoneId === parentNodeId);
            if (parentPos) {
                const homePos = positions.find(np => np.zoneId === homeZoneId.value);
                console.log('DEBUG: positions:', positions, 'homeZoneId:', homeZoneId.value);
                const direction = parentPos.x >= (homePos?.x ?? 0) ? 250 : -250;
                let newX = parentPos.x + direction;
                let newY = parentPos.y;
                    
                // Collision check against ALL updated positions
                while (positions.some(p => p.x === newX && p.y === newY)) {
                    newY += 150;
                }
                    
                positions.push({ zoneId: newNodeId, x: newX, y: newY, virtualGridPos: { x: newX, y: newY } });
                existingNodeIds.add(newNodeId);
                hasNewNodes = true;
            }
        }
    }

    if (hasNewNodes) {
        isSkippingAutoLayout.value = true;
        store.updateNodePositionsInStore(positions);
    } else if (isSkippingAutoLayout.value) {
        isSkippingAutoLayout.value = false;
    } else {
        // No auto-layout
        // Ensure all connected nodes exist (if not in nodePositions, add with (0,0))
        connections.value.forEach(conn => {
            if (!positions.some(p => p.zoneId === conn.fromZoneId)) {
                positions.push({ zoneId: conn.fromZoneId, x: 0, y: 0 });
            }
            if (!positions.some(p => p.zoneId === conn.toZoneId)) {
                positions.push({ zoneId: conn.toZoneId, x: 0, y: 0 });
            }
        });

        // If new nodes were added, update the store.
        const hasNewPositions = positions.some(p => !nodePositions.value.find(np => np.zoneId === p.zoneId));
        if (hasNewPositions) {
            const updatedPositions = positions.map(p => ({ zoneId: p.zoneId, x: p.x, y: p.y, features: p.features }));
            store.updateNodePositionsInStore(updatedPositions);
        }
    }
    
    // 2. Map to VueFlow nodes
    const newNodes = positions.map((pos: NodePosition) => {
      const zone = ZONE_BY_ID.get(pos.zoneId);
      const isDraggable = positions.length > 1 && pos.zoneId !== homeZoneId.value;
      return {
        id: pos.zoneId,
        type: 'zone',
        position: { x: pos.x, y: pos.y },
        draggable: isDraggable,
        data: {
          isHome: pos.zoneId === homeZoneId.value,
          tier: zone?.tier ?? 0,
          zoneName: zone?.name ?? pos.zoneId,
          type: zone?.type ?? 'other',
          virtualGridPos: pos.virtualGridPos,
          features: pos.features,
        },
      };
    });

    // Update nodes using VueFlow's updateNode for reactivity
    newNodes.forEach(newNode => {
        const existingNode = flowNodes.value.find(n => n.id === newNode.id);
        if (existingNode) {
            updateNode(newNode.id, newNode);
        } else {
            flowNodes.value.push(newNode);
        }
    });

    // Remove nodes that are no longer present
    flowNodes.value = flowNodes.value.filter(n => newNodes.find(nn => nn.id === n.id));

    // 3. Map to VueFlow edges
    flowEdges.value = connections.value.map((conn: Connection) => {
      const sourceNode = flowNodes.value.find((n) => n.id === conn.fromZoneId);
      const targetNode = flowNodes.value.find((n) => n.id === conn.toZoneId);

      const { style } = getEdgeParams(conn, now.value);

      const edge: Edge = {
        id: conn.id,
        source: conn.fromZoneId,
        target: conn.toZoneId,
        type: 'connection',
        animated: style.animated,
        data: {
          connection: conn,
          now: now.value,
          onDelete: async (id: string) => {
            await deleteConnection(props.id, store.token!, id);
          },
          onUpdate: async (id: string, minutesRemaining: number) => {
            await updateConnection(props.id, store.token!, id, minutesRemaining);
          },
        },
      };

      if (sourceNode && targetNode) {
        const handles = computeHandles(sourceNode, targetNode);
        Object.assign(edge, handles);
      }
      return edge;
    });
}, { immediate: true, deep: true });

// Update edge labels every second based on `now`
watch(now, () => {
  flowEdges.value.forEach((edge) => {
    const conn = store.connections.find((c) => c.id === edge.id);
    if (conn) {
      const { remainingMs, isStale, style } = getEdgeParams(conn, now.value);
      edge.label = formatExpiresIn(remainingMs);
      edge.animated = style.animated;
      edge.data.now = now.value;
    }
  });
});
const showDebug = ref(false);

// ── Actions ──────────────────────────────────────────────────────────────────
function onNodeDragStop() {
  const positions: NodePosition[] = flowNodes.value.map((n: any) => ({
    zoneId: n.id,
    x: n.position.x,
    y: n.position.y,
    features: n.data.features,
  }));
  store.updateNodePositionsInStore(positions);
}

const reportForm = ref<InstanceType<typeof ReportForm> | null>(null);

function handleSuccess(msg: string) {
  showToast(msg);
}

function handleConnect() {
  wasConnected = true;
}

function handleConnectStart(params: OnConnectStartParams & { event?: MouseEvent }) {
  draggingFromNodeId = params.nodeId ?? null;
}

function handleConnectEnd(event?: MouseEvent) {
  if (wasConnected) {
    wasConnected = false;
    draggingFromNodeId = null;
    return;
  }
  
  const fromNodeId = draggingFromNodeId;
  
  if (fromNodeId) {
     reportForm.value?.setFromZoneId(fromNodeId);
     reportForm.value?.focusToCombobox();
     reportForm.value?.flashToCombobox();
  }
  
  draggingFromNodeId = null;
}

function handleSetHomeZone(zoneId: string) {
  if (zoneId === store.homeZoneId) return;
  setHomeZone(props.id, store.token!, zoneId);
}

defineExpose({ flowNodes, onNodeDragStop });
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-950 text-white">
    <!-- Sticky report panel -->
    <div class="shrink-0">
      <ReportForm ref="reportForm" @success="handleSuccess" @error="showToast" />
    </div>

    <!-- WS status bar (always visible) -->
    <div class="shrink-0 px-3 py-1 text-xs flex items-center justify-center" :class="store.wsStatus === 'connected' ? 'bg-green-900 text-green-300' : store.wsStatus === 'connecting' ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'">
      <span v-if="store.wsStatus === 'connected'">
        ● Connected – Last update
        <span
          class="status-update-time"
          :class="{ 'status-update-flash': lastUpdateFlash }"
        >{{ store.lastUpdate ? formatTime(store.lastUpdate) : '…' }}</span>
      </span>
      <span v-else-if="store.wsStatus === 'connecting'">⟳ Connecting…</span>
      <span v-else>⚠ Disconnected — reconnecting…</span>
    </div>

    <!-- Graph -->
    <div class="flex-1 relative">
      <VueFlow
        v-model:nodes="flowNodes"
        v-model:edges="flowEdges"
        :node-types="{ zone: markRaw(ZoneNode) }"
        :edge-types="{ connection: markRaw(ConnectionEdge) }"
        :fit-view-on-init="true"
        :connection-mode="ConnectionMode.Loose"
        class="bg-gray-950"
        @node-click="(e) => handleSetHomeZone(e.node.id)"
        @node-drag-stop="onNodeDragStop"
        @connect="handleConnect"
        @connect-start="handleConnectStart"
        @connect-end="handleConnectEnd"
      >
        <Background />
        <Controls />
      </VueFlow>
    </div>

    <!-- Debug tray button -->
    <button
      class="fixed bottom-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 border border-gray-600 hover:bg-gray-700 text-lg shadow-lg"
      title="Debug tray"
      @click="showDebug = true"
    >🐛</button>

    <!-- Refresh layout button -->
    <!-- Removed as per user request -->

    <!-- Fit view button -->
    <button
      class="fixed bottom-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 border border-gray-600 hover:bg-gray-700 text-lg shadow-lg"
      title="Fit view"
      @click="fitView({ padding: 0.2, duration: 300 })"
    >🔄</button>

    <!-- Debug tray modal -->
    <DebugTray :nodes="flowNodes" :edges="flowEdges" :show="showDebug" @close="showDebug = false" />

    <!-- Toast -->
    <Transition name="toast">
      <div
        v-if="toast"
        class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-sm text-white shadow-lg flex items-center gap-3"
      >
        <span>{{ toast }}</span>
        <button
          v-if="isShareUrl"
          class="text-indigo-400 hover:text-indigo-300 font-medium underline"
          @click="copyShareUrl"
        >
          Copy
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(1rem);
}

/* Status bar: "Last update" time flash */
.status-update-time {
  display: inline-block;
  padding: 0 4px;
  border-radius: 3px;
  position: relative;
}

/* White background that fades to transparent */
.status-update-time::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 3px;
  background: white;
  opacity: 0;
  pointer-events: none;
}

.status-update-flash::after {
  animation: update-flash 2s ease-out forwards;
}

@keyframes update-flash {
  0%   { opacity: 0.85; }
  15%  { opacity: 0.85; }
  100% { opacity: 0; }
}
</style>
