<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, watchEffect, nextTick, markRaw, provide } from 'vue';
import { useRouter } from 'vue-router';
// @ts-ignore
import VueKofi from 'vue-kofi';
import { storeToRefs } from 'pinia';
import { useRoomStore } from '@/stores/useRoomStore';
import ReportForm from '../components/ReportForm.vue';
import RoomSettings from '../components/RoomSettings.vue';
import DebugTray from '../components/DebugTray.vue';
import ZoneNode from '../components/flow/ZoneNode.vue';
import ConnectionEdge from '../components/flow/ConnectionEdge.vue';
import ActiveCoreSummary from '../components/flow/zone/ActiveCoreSummary.vue';
import RoomSummaryToolbar from '../components/flow/zone/RoomSummaryToolbar.vue';
import { VueFlow, useVueFlow, ConnectionMode, type Node, type Edge, type OnConnectStartParams } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { formatTime, formatExpiresIn } from '../utils/formatters.js';
import { deleteConnection, updateConnection } from '../utils/roomOperations.js';
import { connectionStyle } from '../utils/connectionStyle.js';
import { ZONE_BY_ID, type Connection, type NodePosition, type NodeFeatures, getDefaultHandles } from 'shared';

const props = defineProps<{ id: string }>();
const store = useRoomStore();
const { connections, homeZoneId, roomTitle, nodePositions, lastUpdate } = storeToRefs(store);
const router = useRouter();

// ── Toast ────────────────────────────────────────────────────────────────────
const toast = ref('');
const toastType = ref<'info' | 'error'>('info');
const megaToast = ref('');
const megaToastRegion = ref('');
const megaToastBackgroundActive = ref(false);
let megaToastTimeout: ReturnType<typeof setTimeout> | null = null;
let megaToastBgTimeout: ReturnType<typeof setTimeout> | null = null;
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
  window.addEventListener('keydown', handleKeyDown);
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

function showMegaToast(region: string) {
  megaToastRegion.value = region;
  megaToast.value = `Enemies sighted in ${region}!`;
  megaToastBackgroundActive.value = true;

  if (megaToastTimeout) clearTimeout(megaToastTimeout);
  if (megaToastBgTimeout) clearTimeout(megaToastBgTimeout);

  megaToastTimeout = setTimeout(() => (megaToast.value = ''), 8000);
  megaToastBgTimeout = setTimeout(() => (megaToastBackgroundActive.value = false), 2500);
}

provide('showToast', showToast);

// ── Countdown ticker ─────────────────────────────────────────────────────────
const now = ref(Date.now());
provide('globalNow', now);
const ticker = setInterval(() => (now.value = Date.now()), 1000);
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  clearInterval(ticker);
  store.disconnect();
  if (toastTimeout) clearTimeout(toastTimeout);
  if (megaToastTimeout) clearTimeout(megaToastTimeout);
  if (megaToastBgTimeout) clearTimeout(megaToastBgTimeout);
  if (flashTimeout) clearTimeout(flashTimeout);
});


// ── Vue Flow nodes/edges ──────────────────────────────────────────────────────
const { fitView, updateNode, setCenter } = useVueFlow();
const openPopoverId = ref<string | null>(null);
provide('openPopoverId', openPopoverId);

const flowNodes = ref<any[]>([]);
const flowEdges = ref<any[]>([]);
const isSkippingAutoLayout = ref(false);
let wasConnected = false;
let draggingFromNodeId: string | null = null;
let draggingFromHandleId: string | null = null;

function getEdgeParams(conn: Connection, currentTime: number) {
  const expiresAt = new Date(conn.expiresAt).getTime();
  const remainingMs = expiresAt - currentTime;
  const style = connectionStyle(remainingMs, conn.isExpired ?? false);
  return { remainingMs, style };
}

function computeHandles(sourceNode: any, targetNode: any, conn?: Connection) {
  let sourceHandle = conn?.fromHandleId ?? 'center';
  let targetHandle = conn?.toHandleId ?? 'center';

  // Resolve 'center' to one of 4 directional default handles
  if (sourceHandle === 'center' || targetHandle === 'center') {
    const dx = targetNode.position.x - sourceNode.position.x;
    const dy = targetNode.position.y - sourceNode.position.y;
    const angle = Math.atan2(dy, dx);
    let deg = (angle * 180) / Math.PI;
    if (deg < 0) deg += 360;

    const resolveDefault = (d: number) => {
      if (d >= 0 && d < 90) return 'default-se';
      if (d >= 90 && d < 180) return 'default-sw';
      if (d >= 180 && d < 270) return 'default-nw';
      return 'default-ne';
    };

    if (sourceHandle === 'center') sourceHandle = resolveDefault(deg);
    if (targetHandle === 'center') targetHandle = resolveDefault((deg + 180) % 360);
  }

  return { sourceHandle, targetHandle };
}

const initialRedsHandled = ref(false);
const activeRedsIds = ref(new Set<string>());

watch(nodePositions, (newPositions) => {
  const currentActiveIds = new Set<string>();
  
  for (const np of newPositions) {
    const isActive = np.features?.reds !== undefined && np.features?.reds !== 0;
    
    if (isActive) {
      if (!activeRedsIds.value.has(np.zoneId)) {
        if (initialRedsHandled.value) {
          const zone = ZONE_BY_ID.get(np.zoneId);
          showMegaToast(zone?.name || np.zoneId);
        }
      }
      currentActiveIds.add(np.zoneId);
    }
  }
  
  activeRedsIds.value = currentActiveIds;
  initialRedsHandled.value = true;
}, { deep: true });

watch([homeZoneId, nodePositions, connections], (newVal, oldVal) => {
    if (!homeZoneId.value) return;

    const newConnections = connections.value;
    const oldConnections = (oldVal && oldVal[2]) ? oldVal[2] as Connection[] : [];
    const existingNodeIds = new Set<string>();
    let positions: NodePosition[] = [];
    for (const np of nodePositions.value) {
        if (!existingNodeIds.has(np.zoneId)) {
            positions.push(np);
            existingNodeIds.add(np.zoneId);
        }
    }

    // Find new connections
    const addedConnections = newConnections.filter(c => !oldConnections.find(oc => oc.id === c.id));
    
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
                const direction = parentPos.x >= (homePos?.x ?? 0) ? 400 : -400;
                let newX = parentPos.x + direction;
                let newY = parentPos.y;
                    
                // Collision check against ALL updated positions
                while (positions.some(p => p.x === newX && p.y === newY)) {
                    newY += 300;
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
            const updatedPositions = positions.map(p => ({ 
                zoneId: p.zoneId, 
                x: p.x, 
                y: p.y, 
                features: p.features,
                customHandles: p.customHandles,
                virtualGridPos: p.virtualGridPos 
            }));
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
          mapShape: zone?.mapShape,
          customHandles: pos.customHandles,
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
            try {
              await deleteConnection(props.id, store.token!, id);
            } catch (err: any) {
              console.error('Failed to delete connection:', err);
              if (showToast) showToast(`Delete failed: ${err.message}`, 'error');
            }
          },
          onDeleteRecursive: async (id: string) => {
            try {
              const toDelete = new Set<string>();
              const queue = [id];
              
              while (queue.length > 0) {
                const currentId = queue.shift()!;
                if (toDelete.has(currentId)) continue;
                toDelete.add(currentId);
                
                const conn = connections.value.find(c => c.id === currentId);
                if (conn) {
                  const children = connections.value.filter(c => c.fromZoneId === conn.toZoneId);
                  for (const child of children) {
                    queue.push(child.id);
                  }
                }
              }
              
              // Delete in reverse order to help server-side cleanup logic (leaf to root)
              const toDeleteArray = Array.from(toDelete).reverse();
              for (const connId of toDeleteArray) {
                await deleteConnection(props.id, store.token!, connId);
              }
            } catch (err: any) {
              console.error('Failed to delete connections:', err);
              if (showToast) showToast(`Delete failed: ${err.message}`, 'error');
            }
          },
          onUpdate: async (id: string, secondsRemaining: number) => {
            await updateConnection(props.id, store.token!, id, { secondsRemaining: Number(secondsRemaining) });
          },
          hasChildren: connections.value.some(c => c.fromZoneId === conn.toZoneId),
        },
      };

      if (sourceNode && targetNode) {
        const handles = computeHandles(sourceNode, targetNode, conn);
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
const showDebugOverride = ref(false);
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

function handleKeyDown(e: KeyboardEvent) {
  if (e.altKey && e.code === 'KeyD') {
    e.preventDefault();
    showDebugOverride.value = !showDebugOverride.value;
  }
}
const showMobileSummary = ref(false);

// ── Actions ──────────────────────────────────────────────────────────────────
function onNodeDragStop() {
  const positions: NodePosition[] = flowNodes.value.map((n: any) => ({
    zoneId: n.id,
    x: n.position.x,
    y: n.position.y,
    features: n.data.features,
    customHandles: n.data.customHandles,
    virtualGridPos: n.data.virtualGridPos,
  }));
  store.updateNodePositionsInStore(positions);
}

const reportForm = ref<InstanceType<typeof ReportForm> | null>(null);

const activeCores = computed(() => {
  const cores: { zoneId: string; zoneName: string; type: string; expiresAt: number; coreType: 'green' | 'blue' | 'purple' | 'yellow' }[] = [];
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
    if (features.powercoreTimerYellow && features.powercoreTimerYellow > now.value) {
      cores.push({ zoneId: node.id, zoneName: node.data.zoneName, type: node.data.type, expiresAt: features.powercoreTimerYellow, coreType: 'yellow' });
    }
  });
  return cores.sort((a, b) => a.expiresAt - b.expiresAt);
});

const activeCrystals = computed(() => {
  return flowNodes.value
    .filter(node => node.data.features?.crystalCreaturePresent)
    .map(node => ({ zoneId: node.id, zoneName: node.data.zoneName }))
    .sort((a, b) => a.zoneName.localeCompare(b.zoneName));
});

const activeDungeons = computed(() => {
  const dungeons: { zoneId: string; zoneName: string; type: 'static' | 'group' }[] = [];
  flowNodes.value.forEach(node => {
    const f = node.data.features;
    if (!f) return;
    if (f.dungeonStatic) dungeons.push({ zoneId: node.id, zoneName: node.data.zoneName, type: 'static' });
    if (f.dungeonGroup) dungeons.push({ zoneId: node.id, zoneName: node.data.zoneName, type: 'group' });
  });
  return dungeons.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
});

const activeChests = computed(() => {
  const result: { zoneId: string; zoneName: string; type: 'green' | 'blue' | 'yellow' | 'chest' }[] = [];
  flowNodes.value.forEach(node => {
    const f = node.data.features;
    if (!f) return;
    if (f.treasuresGreen) result.push({ zoneId: node.id, zoneName: node.data.zoneName, type: 'green' });
    if (f.treasuresBlue) result.push({ zoneId: node.id, zoneName: node.data.zoneName, type: 'blue' });
    if (f.treasuresYellow) result.push({ zoneId: node.id, zoneName: node.data.zoneName, type: 'yellow' });
    if (f.chest) result.push({ zoneId: node.id, zoneName: node.data.zoneName, type: 'chest' });
  });
  return result.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
});

const hasAnySummaryItems = computed(() => {
  return activeCores.value.length > 0 || 
         activeCrystals.value.length > 0 || 
         activeDungeons.value.length > 0 || 
         activeChests.value.length > 0;
});

function goToNode(nodeId: string) {
  const node = flowNodes.value.find(n => n.id === nodeId) as any;
  if (node) {
    const width = node.dimensions?.width || 220;
    const height = node.dimensions?.height || 160;
    const centerX = node.position.x + (width / 2);
    const centerY = node.position.y + (height / 2);
    setCenter(centerX, centerY, { zoom: 2, duration: 800 });
    showMobileSummary.value = false;

    // Apply brief glow
    node.data.highlighted = true;
    setTimeout(() => {
      node.data.highlighted = false;
    }, 1500);
  }
}

function handleSuccess(msg: string) {
  showToast(msg);
}

async function onEdgeUpdate({ edge, connection }: any) {
  if (edge.source === connection.source && edge.target === connection.target) {
    try {
      await updateConnection(props.id, store.token!, edge.id, {
        fromHandleId: connection.sourceHandle,
        toHandleId: connection.targetHandle
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to update connection', 'error');
    }
  }
}

async function handleConnect(params: any) {
  wasConnected = true;

  // Check for existing connection between these two zones
  const existing = store.connections.find(c =>
    !c.isExpired &&
    ((c.fromZoneId === params.source && c.toZoneId === params.target) ||
     (c.fromZoneId === params.target && c.toZoneId === params.source))
  );

  if (existing) {
    // Determine which handle is which based on the existing connection direction
    let fHandleId = params.sourceHandle;
    let tHandleId = params.targetHandle;

    if (existing.fromZoneId === params.target) {
      fHandleId = params.targetHandle;
      tHandleId = params.sourceHandle;
    }

    try {
      await updateConnection(props.id, store.token!, existing.id, {
        fromHandleId: fHandleId,
        toHandleId: tHandleId
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to update connection', 'error');
    }
    return;
  }

  reportForm.value?.setConnection(
    params.source,
    params.sourceHandle,
    params.target,
    params.targetHandle
  );
  reportForm.value?.focusTimeInput();
}

function handleConnectStart(params: OnConnectStartParams & { event?: MouseEvent }) {
  draggingFromNodeId = params.nodeId ?? null;
  draggingFromHandleId = params.handleId ?? null;
}

function handleConnectEnd(event?: MouseEvent) {
  if (wasConnected) {
    wasConnected = false;
    draggingFromNodeId = null;
    return;
  }
  
  const fromNodeId = draggingFromNodeId;
  const fromHandleId = draggingFromHandleId;
  
  if (fromNodeId) {
     reportForm.value?.setFromZoneId(fromNodeId, fromHandleId);
     reportForm.value?.focusToCombobox();
     reportForm.value?.flashToCombobox();
  }
  
  draggingFromNodeId = null;
  draggingFromHandleId = null;
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
        class="transition-colors duration-1000"
        :class="megaToastBackgroundActive ? 'bg-red-950' : 'bg-gray-950'"
        @node-drag-stop="onNodeDragStop"
        @edge-update="onEdgeUpdate"
        @connect="handleConnect"
        @connect-start="handleConnectStart"
        @connect-end="handleConnectEnd"
      >
        <Background />
        <Controls />
      </VueFlow>

      <!-- Mega Toast -->
      <Transition name="mega-toast">
        <div v-if="megaToast" class="absolute top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none w-full max-w-[95vw] flex justify-center px-4">
           <div class="bg-red-700 text-white px-6 py-3 rounded-full shadow-2xl border-2 border-red-400">
              <span class="text-lg md:text-2xl font-bold uppercase tracking-wider text-center block">
                Enemies sighted in {{ megaToastRegion }}!
              </span>
           </div>
        </div>
      </Transition>

      <!-- Summary Toolbar (Desktop) -->
      <div v-if="hasAnySummaryItems" class="absolute top-4 right-4 z-40 hidden md:flex pointer-events-none">
        <RoomSummaryToolbar 
          :cores="activeCores"
          :crystals="activeCrystals"
          :dungeons="activeDungeons"
          :chests="activeChests"
          @select="goToNode"
        />
      </div>
    </div>

    <!-- Tray buttons -->
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-4">
      <!-- Debug tray button -->
      <button
        v-if="isLocal || showDebugOverride"
        class="w-12 h-12 flex items-center justify-center rounded-full bg-gray-800 border border-gray-600 hover:bg-gray-700 text-xl shadow-lg"
        title="Debug tray"
        @click="showDebug = true"
      >🐛</button>
      <!-- Active Cores button (mobile only) -->
      <button
        v-if="hasAnySummaryItems"
        class="w-12 h-12 flex items-center justify-center rounded-full bg-indigo-600 border border-indigo-400 text-xl shadow-lg md:hidden"
        title="Room Summary"
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

    <Transition name="toast">
      <div v-if="showMobileSummary" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 md:hidden" @click.self="showMobileSummary = false">
        <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900 rounded-t-xl sticky top-0 z-10">
            <h2 class="text-base font-bold uppercase text-gray-400">Room Summary</h2>
            <button class="text-gray-400 hover:text-white text-xl leading-none" @click="showMobileSummary = false">&times;</button>
          </div>
          <div class="flex-1 overflow-y-auto p-4">
             <RoomSummaryToolbar 
                :cores="activeCores"
                :crystals="activeCrystals"
                :dungeons="activeDungeons"
                :chests="activeChests"
                @select="goToNode"
              />
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
    <!-- Ko-fi button -->
    <div class="fixed bottom-4 left-4 z-50">
      <VueKofi uid="K3K5156KXP" color="#302f86" text="Tip the Navigator!" />
    </div>
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

.mega-toast-enter-active {
  animation: mega-toast-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.mega-toast-leave-active {
  animation: mega-toast-out 0.5s cubic-bezier(0.6, -0.28, 0.735, 0.045);
}

@keyframes mega-toast-in {
  0% { transform: translate(-50%, -100%) scale(0.5); opacity: 0; }
  100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
}

@keyframes mega-toast-out {
  0% { transform: translate(-50%, 0) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -100%) scale(0.5); opacity: 0; }
}
</style>
