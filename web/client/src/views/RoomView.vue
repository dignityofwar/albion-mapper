<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, watchEffect, nextTick, markRaw, provide } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useRoomStore } from '@/stores/useRoomStore';
import ReportForm from '../components/ReportForm.vue';
import RoomSettings from '../components/RoomSettings.vue';
import DebugTray from '../components/DebugTray.vue';
import ZoneNode from '../components/flow/ZoneNode.vue';
import ConnectionEdge from '../components/flow/ConnectionEdge.vue';
import { VueFlow, useVueFlow, ConnectionMode, type Node, type Edge, type OnConnectStartParams } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { formatTime, formatExpiresIn } from '../utils/formatters.js';
import { deleteConnection, updateConnection } from '../utils/roomOperations.js';
import { connectionStyle } from '../utils/connectionStyle.js';
import { ZONE_BY_ID, type Connection, type NodePosition, type NodeFeatures } from 'shared';

const props = defineProps<{ id: string }>();
const store = useRoomStore();
const { connections, homeZoneId, roomTitle, nodePositions, lastUpdate } = storeToRefs(store);
const router = useRouter();

// ── Toast ────────────────────────────────────────────────────────────────────
const toast = ref('');
const toastType = ref<'info' | 'error'>('info');
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

function showToast(msg: string, type: 'info' | 'error' = 'info') {
  toast.value = msg;
  toastType.value = type;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => (toast.value = ''), 5000);
}

provide('showToast', showToast);

// ── Countdown ticker ─────────────────────────────────────────────────────────
const now = ref(Date.now());
provide('globalNow', now);
const ticker = setInterval(() => (now.value = Date.now()), 1000);
onUnmounted(() => {
  clearInterval(ticker);
  store.disconnect();
  if (toastTimeout) clearTimeout(toastTimeout);
  if (flashTimeout) clearTimeout(flashTimeout);
});


// ── Vue Flow nodes/edges ──────────────────────────────────────────────────────
const { fitView, updateNode, setCenter } = useVueFlow();
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
  const style = connectionStyle(remainingMs, conn.isExpired ?? false);
  return { remainingMs, style };
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
    const oldConnections = (oldVal && oldVal[2]) ? oldVal[2] as Connection[] : [];
    const existingNodeIds = new Set(nodePositions.value.map(np => np.zoneId));

    // Find new connections
    const addedConnections = newConnections.filter(c => !oldConnections.find(oc => oc.id === c.id));
        
    // 1. Compute positions
    let positions: NodePosition[] = [...nodePositions.value];
    
    // Ensure home zone exists in positions
    if (homeZoneId.value && !existingNodeIds.has(homeZoneId.value)) {
        positions.push({ zoneId: homeZoneId.value, x: 0, y: 0 });
        existingNodeIds.add(homeZoneId.value);
    }
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
                const direction = parentPos.x >= (homePos?.x ?? 0) ? 350 : -350;
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
    } else {
        if (isSkippingAutoLayout.value) {
            isSkippingAutoLayout.value = false;
        }

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
          category: zone?.category,
          virtualGridPos: pos.virtualGridPos,
          features: pos.features,
        },
      };
    });

    // Update nodes using VueFlow's updateNode for reactivity
    newNodes.forEach(newNode => {
        const existingNode = flowNodes.value.find(n => n.id === newNode.id);
        if (existingNode) {
            existingNode.position = newNode.position;
            existingNode.data = newNode.data;
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
          onUpdate: async (id: string, secondsRemaining: number) => {
            await updateConnection(props.id, store.token!, id, secondsRemaining);
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
      const { remainingMs, style } = getEdgeParams(conn, now.value);
      edge.label = formatExpiresIn(remainingMs);
      edge.animated = style.animated;
      edge.data.now = now.value;
    }
  });
});
const showDebug = ref(false);
const showMobileSummary = ref(false);

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

const activeCores = computed(() => {
  const cores: { zoneId: string; zoneName: string; type: string; expiresAt: number; coreType: 'green' | 'blue' | 'purple' }[] = [];
  flowNodes.value.forEach(node => {
    const features = node.data.features as NodeFeatures | undefined;
    if (!features) return;
    
    if (features.powercoreTimerGreen && features.powercoreTimerGreen > now.value) {
      cores.push({ zoneId: node.id, zoneName: node.data.zoneName, type: node.data.type, expiresAt: features.powercoreTimerGreen, coreType: 'green' });
    }
    if (features.powercoreTimerBlue && features.powercoreTimerBlue > now.value) {
      cores.push({ zoneId: node.id, zoneName: node.data.zoneName, type: node.data.type, expiresAt: features.powercoreTimerBlue, coreType: 'blue' });
    }
    if (features.powercoreTimerPurple && features.powercoreTimerPurple > now.value) {
      cores.push({ zoneId: node.id, zoneName: node.data.zoneName, type: node.data.type, expiresAt: features.powercoreTimerPurple, coreType: 'purple' });
    }
  });
  return cores.sort((a, b) => a.expiresAt - b.expiresAt);
});

function formatTimerMMSS(expiresAtMs: number): string {
  const remaining = Math.max(0, Math.floor((expiresAtMs - now.value) / 1000));
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function goToNode(nodeId: string) {
  const node = flowNodes.value.find(n => n.id === nodeId);
  if (node) {
    setCenter(node.position.x + 70, node.position.y + 40, { zoom: 1.2, duration: 800 });
    showMobileSummary.value = false;
  }
}

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


defineExpose({ flowNodes, onNodeDragStop });
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-950 text-white">
    <!-- Tablet Header -->
    <div class="hidden md:flex xl:hidden items-center px-4 py-3 bg-gray-900 border-b border-gray-700 shrink-0 gap-4" data-testid="tablet-header">
      <RoomSettings />
      <h1 v-if="roomTitle" class="text-lg font-semibold text-indigo-400 truncate leading-none" data-testid="room-title-tablet">{{ roomTitle }}</h1>
    </div>

    <!-- Sticky report panel -->
    <div class="shrink-0 relative">
      <!-- Desktop side title & settings -->
      <div class="hidden xl:flex absolute left-4 inset-y-0 z-50 items-center gap-4 xl:max-w-[calc(100vw_-_1132px)] 2xl:max-w-[calc((100vw_-_1100px)_/_2_-_32px)] pointer-events-none" data-testid="desktop-side-header">
        <RoomSettings class="pointer-events-auto" />
        <h1 v-if="roomTitle" class="text-2xl font-bold text-gray-200 truncate leading-none min-w-0 pointer-events-auto" :title="roomTitle" data-testid="room-title-desktop">{{ roomTitle }}</h1>
      </div>

      <ReportForm ref="reportForm" @success="handleSuccess" @error="msg => showToast(msg, 'error')" />
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
        @node-drag-stop="onNodeDragStop"
        @connect="handleConnect"
        @connect-start="handleConnectStart"
        @connect-end="handleConnectEnd"
      >
        <Background />
        <Controls />
      </VueFlow>

      <!-- Core Summary (Desktop) -->
      <div v-if="activeCores.length > 0" class="absolute top-4 right-4 z-40 hidden md:flex flex-col gap-2 w-64 pointer-events-none">
        <div class="bg-gray-900/90 border border-gray-700 rounded-lg p-3 shadow-xl backdrop-blur-sm pointer-events-auto">
          <div class="text-sm uppercase text-gray-400 font-bold mb-3 px-1 flex items-center justify-between">
            <span>Active Cores</span>
            <span class="bg-gray-800 text-xs px-2 py-0.5 rounded text-gray-300">{{ activeCores.length }}</span>
          </div>
          <div class="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto pr-1">
            <button 
              v-for="core in activeCores" 
              :key="`${core.zoneId}-${core.coreType}`"
              @click="goToNode(core.zoneId)"
              class="flex items-center justify-between gap-3 px-2.5 py-2 rounded bg-gray-800 hover:bg-gray-700 transition-colors text-left group"
            >
              <div class="flex items-center gap-2 min-w-0">
                <img v-if="core.coreType === 'green'" src="/images/core-green.png" class="w-5 h-5 p-[2px]" />
                <img v-else-if="core.coreType === 'blue'" src="/images/core-blue.png" class="w-5 h-5 p-[2px]" />
                <img v-else-if="core.coreType === 'purple'" src="/images/core-purple.png" class="w-5 h-5 p-[2px]" />
                <span class="text-sm truncate font-medium group-hover:text-indigo-300">{{ core.zoneName }}</span>
              </div>
              <span class="text-xs font-mono text-gray-300 shrink-0 bg-gray-950 px-1.5 py-0.5 rounded border border-gray-700">{{ formatTimerMMSS(core.expiresAt) }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Debug tray button -->
    <button
      class="fixed bottom-4 left-4 z-50 w-12 h-12 flex items-center justify-center rounded-full bg-gray-800 border border-gray-600 hover:bg-gray-700 text-xl shadow-lg"
      title="Debug tray"
      @click="showDebug = true"
    >🐛</button>

    <!-- Refresh layout button -->
    <!-- Removed as per user request -->

    <!-- Tray buttons -->
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-4">
      <!-- Active Cores button (mobile only) -->
      <button
        v-if="activeCores.length > 0"
        class="w-12 h-12 flex items-center justify-center rounded-full bg-indigo-600 border border-indigo-400 text-xl shadow-lg md:hidden"
        title="Active Cores"
        @click="showMobileSummary = true"
      >
        <img src="/images/core-green.png" class="w-8 h-8 p-[2px]" />
      </button>

      <!-- Fit view button -->
      <button
        class="w-12 h-12 flex items-center justify-center rounded-full bg-gray-800 border border-gray-600 hover:bg-gray-700 text-xl shadow-lg"
        title="Fit view"
        @click="fitView({ padding: 0.2, duration: 300 })"
      >🔄</button>

      <!-- Settings button (mobile only) -->
      <RoomSettings tray class="md:hidden" />
    </div>

    <!-- Mobile Core Summary Modal -->
    <Transition name="toast">
      <div v-if="showMobileSummary" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 md:hidden" @click.self="showMobileSummary = false">
        <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-xl w-full max-w-sm flex flex-col max-h-[80vh]">
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <div class="flex items-center gap-2">
              <h2 class="text-base font-bold uppercase text-gray-400">Active Cores</h2>
              <span class="bg-gray-800 text-xs px-2 py-0.5 rounded text-gray-300">{{ activeCores.length }}</span>
            </div>
            <button class="text-gray-400 hover:text-white text-xl leading-none" @click="showMobileSummary = false">&times;</button>
          </div>
          <div class="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            <button 
              v-for="core in activeCores" 
              :key="`${core.zoneId}-${core.coreType}`"
              @click="goToNode(core.zoneId)"
              class="flex items-center justify-between gap-4 px-3 py-2 rounded-lg bg-gray-800 active:bg-gray-700 transition-colors text-left"
            >
              <div class="flex items-center gap-3 min-w-0">
                <img v-if="core.coreType === 'green'" src="/images/core-green.png" class="w-8 h-8 p-[2px]" />
                <img v-else-if="core.coreType === 'blue'" src="/images/core-blue.png" class="w-8 h-8 p-[2px]" />
                <img v-else-if="core.coreType === 'purple'" src="/images/core-purple.png" class="w-8 h-8 p-[2px]" />
                <span class="text-sm font-bold truncate">{{ core.zoneName }}</span>
              </div>
              <span class="text-sm font-mono font-bold text-indigo-300 bg-gray-950 px-2 py-1 rounded border border-gray-700 shrink-0">{{ formatTimerMMSS(core.expiresAt) }}</span>
            </button>
            <div v-if="activeCores.length === 0" class="text-center py-8 text-gray-500">
              No active cores
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Debug tray modal -->
    <DebugTray :nodes="flowNodes" :edges="flowEdges" :show="showDebug" @close="showDebug = false" />

    <!-- Toast -->
    <Transition name="toast">
      <div
        v-if="toast"
        class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2 text-sm text-white shadow-lg flex items-center gap-3 transition-colors"
        :class="toastType === 'error' ? 'bg-red-900 border border-red-500' : 'bg-gray-800 border border-gray-600'"
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
