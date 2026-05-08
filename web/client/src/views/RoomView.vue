<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, markRaw, provide } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useRoomStore } from '@/stores/useRoomStore';
import { useTutorialStore } from '@/stores/useTutorialStore';
import { Z_INDEX } from '@/constants/Layers';
import ReportForm from '../components/ReportForm.vue';
import DebugTray from '../components/DebugTray.vue';
import ZoneNode from '../components/flow/ZoneNode.vue';
import NonRoadsNode from '../components/flow/NonRoadsNode.vue';
import ConnectionEdge from '../components/flow/ConnectionEdge.vue';
import ConnectionLine from '../components/flow/ConnectionLine.vue';
import TipButton from '../components/TipButton.vue';
import RoomMapFeaturesToolbar from '../components/flow/zone/RoomMapFeaturesToolbar.vue';
import RoomResourcesToolbar from '../components/flow/zone/RoomResourcesToolbar.vue';
import TutorialTooltip from '../components/tutorial/TutorialTooltip.vue';
import MegaToast from '../components/common/MegaToast.vue';
import TitleSegment from '../components/room/TitleSegment.vue';
import TopToolbar from '../components/room/TopToolbar.vue';
import TopLeftToolbar from '../components/room/TopLeftToolbar.vue';
import TopRightToolbar from '../components/room/TopRightToolbar.vue';
import BottomRightPins from '../components/room/BottomRightPins.vue';
import { VueFlow, useVueFlow, ConnectionMode, type Node, type Edge, type OnConnectStartParams } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { formatTime, formatExpiresIn } from '@/utils/formatters';
import { deleteConnection, updateConnection } from '@/utils/roomOperations';
import { connectionStyle } from '@/utils/connectionStyle';
import { ZONE_BY_ID, type Connection, type NodePosition, type NodeFeatures, type ZoneType, wouldCreateCycle, getDefaultHandles, getHandleFacing } from 'shared';

const props = defineProps<{ id: string }>();
const store = useRoomStore();
const tutorialStore = useTutorialStore();
const { connections, homeZoneId, roomTitle, nodePositions, lastUpdate } = storeToRefs(store);
const router = useRouter();

watch(() => store.lastPing, (ping) => {
  if (ping) {
    showPingToast(ping.zoneName, ping.nodeId);
  }
});

provide('goToNode', goToNode);

// ── Toast ────────────────────────────────────────────────────────────────────
const toast = ref('');
const toastType = ref<'info' | 'error'>('info');
const megaToastRegion = ref('');
const megaToastNodeId = ref('');
const megaToastVisible = ref(false);
const megaToastBackgroundActive = ref(false);
const pingToastBackgroundActive = ref(false);
let megaToastTimeout: ReturnType<typeof setTimeout> | null = null;
let megaToastBgTimeout: ReturnType<typeof setTimeout> | null = null;
let pingToastBgTimeout: ReturnType<typeof setTimeout> | null = null;

interface PingToast {
  id: number;
  zoneName: string;
  nodeId: string;
  fadingOut: boolean;
}
const pingToasts = ref<PingToast[]>([]);
let pingToastCounter = 0;
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
  // Nudge mobile browsers to retract their URL bar
  window.scrollTo(0, 1);
});

watch(() => props.id, () => {
  store.disconnect();
  initializeRoom();
});

watch(() => store.wsStatus, (status) => {
  if (status === 'auth_failed') {
    const id = props.id || store.roomId;
    sessionStorage.removeItem(`token:${id}`);
    router.replace(`/rooms/${id}/auth`).catch(() => {
      window.location.href = `/rooms/${id}/auth`;
    });
  }
}, { immediate: true });

async function initializeRoom() {
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

function logout() {
  store.logout();
  router.replace({ path: '/' });
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

function showMegaToast(region: string, nodeId?: string) {
  megaToastRegion.value = region;
  megaToastNodeId.value = nodeId ?? '';
  megaToastVisible.value = true;
  megaToastBackgroundActive.value = true;

  if (megaToastTimeout) clearTimeout(megaToastTimeout);
  if (megaToastBgTimeout) clearTimeout(megaToastBgTimeout);

  megaToastTimeout = setTimeout(() => {
    megaToastVisible.value = false;
  }, 8000);
  megaToastBgTimeout = setTimeout(() => (megaToastBackgroundActive.value = false), 2500);
}

provide('showToast', showToast);

function showPingToast(zoneName: string, nodeId?: string) {
  pingToastBackgroundActive.value = true;
  if (pingToastBgTimeout) clearTimeout(pingToastBgTimeout);
  pingToastBgTimeout = setTimeout(() => (pingToastBackgroundActive.value = false), 1000);

  const id = ++pingToastCounter;
  // Add new toast at the top, leave existing ones running
  pingToasts.value.unshift({ id, zoneName, nodeId: nodeId ?? '', fadingOut: false });
  // Auto-remove after 4s
  setTimeout(() => {
    const toast = pingToasts.value.find(t => t.id === id);
    if (toast) toast.fadingOut = true;
    setTimeout(() => {
      pingToasts.value = pingToasts.value.filter(t => t.id !== id);
    }, 400);
  }, 4000);
}

provide('showPingToast', showPingToast);

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
  if (pingToastBgTimeout) clearTimeout(pingToastBgTimeout);
  if (flashTimeout) clearTimeout(flashTimeout);
  pingToasts.value = [];
});


// ── Vue Flow nodes/edges ──────────────────────────────────────────────────────
const { fitView, updateNode, setCenter, updateNodeInternals, screenToFlowCoordinate, getNode } = useVueFlow();
const openPopoverId = ref<string | null>(null);
provide('openPopoverId', openPopoverId);

const flowNodes = ref<any[]>([]);
const flowEdges = ref<any[]>([]);
const isSkippingAutoLayout = ref(false);
let wasConnected = false;
let draggingFromNodeId: string | null = null;
let draggingFromHandleId: string | null = null;

const ghostNode = ref<Node | null>(null);
const ghostEdge = ref<Edge | null>(null);

function removeGhost() {
  if (ghostNode.value) {
    flowNodes.value = flowNodes.value.filter(n => n.id !== ghostNode.value!.id);
    ghostNode.value = null;
  }
  if (ghostEdge.value) {
    flowEdges.value = flowEdges.value.filter(e => e.id !== ghostEdge.value!.id);
    ghostEdge.value = null;
  }
}

function getEdgeParams(conn: Connection, currentTime: number) {
  const expiresAt = new Date(conn.expiresAt).getTime();
  const remainingMs = expiresAt - currentTime;
  const style = connectionStyle(remainingMs, conn.isExpired ?? false);
  return { remainingMs, style };
}

function computeHandles(sourceNode: any, targetNode: any, conn?: Connection) {
  let sourceHandleId = conn?.fromHandleId ?? 'center';
  let targetHandleId = conn?.toHandleId ?? 'center';

  const findFacing = (node: any, handleId: string) => {
    const customHandles = node.data.customHandles || [];
    const defaultHandles = getDefaultHandles(node.data.type, node.data.mapShape);
    const allHandles = [...customHandles, ...defaultHandles];
    const handle = allHandles.find((h: any) => h.id === handleId);
    if (handle?.position) return handle.position;
    if (handle) return getHandleFacing(handle.left, handle.top);
    return handleId;
  };

  return { 
    sourceHandle: sourceHandleId, 
    targetHandle: targetHandleId,
    sourceFacing: findFacing(sourceNode, sourceHandleId),
    targetFacing: findFacing(targetNode, targetHandleId)
  };
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
          showMegaToast(zone?.name || np.zoneId, np.zoneId);
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

    const existingNodeIds = new Set<string>();
    let positions: NodePosition[] = [];
    for (const np of nodePositions.value) {
        if (!existingNodeIds.has(np.zoneId)) {
            positions.push(np);
            existingNodeIds.add(np.zoneId);
        }
    }

    // Ensure home zone exists in positions
    if (homeZoneId.value && !existingNodeIds.has(homeZoneId.value)) {
        positions.push({ zoneId: homeZoneId.value, x: 0, y: 0 });
        existingNodeIds.add(homeZoneId.value);
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
            virtualGridPos: p.virtualGridPos,
            proximityTo: p.proximityTo || ZONE_BY_ID.get(p.zoneId)?.proximityTo
        }));
        store.updateNodePositionsInStore(updatedPositions);
    }
    
    // 2. Map to VueFlow nodes
    const newNodes = positions.map((pos: NodePosition) => {
      const zone = ZONE_BY_ID.get(pos.zoneId);
      const isDraggable = positions.length > 1;
      const isRoads = zone?.type === 'roads' || zone?.type === 'roadsHideout';

      return {
        id: pos.zoneId,
        type: isRoads ? 'zone' : 'non-roads',
        position: { x: pos.x, y: pos.y },
        draggable: true,
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
          proximityTo: zone?.proximityTo,
          isIsolated: store.isNodeIsolated(pos.zoneId, now.value),
        },
      };
    });

    // Update nodes using VueFlow's updateNode for reactivity
    const nodesWithHandleChanges = new Set<string>();
    newNodes.forEach(newNode => {
      const existingNode = flowNodes.value.find(n => n.id === newNode.id);
      if (existingNode) {
        // Check if handles changed to trigger internal update
        const oldHandles = JSON.stringify(existingNode.data.customHandles);
        const newHandles = JSON.stringify(newNode.data.customHandles);
        
        existingNode.position = newNode.position;
        existingNode.data = newNode.data;
        updateNode(newNode.id, newNode);

        if (oldHandles !== newHandles) {
          nodesWithHandleChanges.add(newNode.id);
        }
      } else {
        flowNodes.value.push(newNode);
      }
    });

    if (nodesWithHandleChanges.size > 0) {
      const nodesToUpdateInternals = new Set(nodesWithHandleChanges);
      nodesWithHandleChanges.forEach(nodeId => {
        connections.value.forEach(conn => {
          if (conn.fromZoneId === nodeId) nodesToUpdateInternals.add(conn.toZoneId);
          if (conn.toZoneId === nodeId) nodesToUpdateInternals.add(conn.fromZoneId);
        });
      });
      nextTick(() => {
        updateNodeInternals(Array.from(nodesToUpdateInternals));
      });
    }

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
          connection: { ...conn },
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
          slots: (targetNode?.data?.features as any)?.slots as (7 | 20 | undefined),
        },
      };

      if (sourceNode && targetNode) {
        const { sourceHandle, targetHandle, sourceFacing, targetFacing } = computeHandles(sourceNode, targetNode, conn);
        edge.sourceHandle = sourceHandle;
        edge.targetHandle = targetHandle;
        edge.data.sourceFacing = sourceFacing;
        edge.data.targetFacing = targetFacing;

        const getHandlePos = (node: any, handleId: string) => {
          const customHandles = node.data.customHandles || [];
          const allHandles = [...customHandles, ...getDefaultHandles(node.data.type, node.data.mapShape)];
          const handle = allHandles.find((h: any) => h.id === handleId) || (handleId === 'center' ? { id: 'center', left: '50%', top: '50%' } : null);
          if (!handle) return null;
          const leftPercent = parseFloat(handle.left) / 100;
          const topPercent = parseFloat(handle.top) / 100;
          const width = node.dimensions?.width || 0;
          const height = node.dimensions?.height || 0;
          return {
            x: node.position.x + leftPercent * width,
            y: node.position.y + topPercent * height
          };
        };

        const startPos = getHandlePos(sourceNode, sourceHandle);
        const endPos = getHandlePos(targetNode, targetHandle);
        
        if (startPos) edge.data.connection.startHandle = { position: startPos };
        if (endPos) edge.data.connection.endHandle = { position: endPos };
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
    
    if (features.powercoreGreen) {
      cores.push({ zoneId: node.id, zoneName: node.data.zoneName, type: node.data.type, expiresAt: features.powercoreTimerGreen || 0, coreType: 'green' });
    }
    if (features.powercoreBlue) {
      cores.push({ zoneId: node.id, zoneName: node.data.zoneName, type: node.data.type, expiresAt: features.powercoreTimerBlue || 0, coreType: 'blue' });
    }
    if (features.powercorePurple) {
      cores.push({ zoneId: node.id, zoneName: node.data.zoneName, type: node.data.type, expiresAt: features.powercoreTimerPurple || 0, coreType: 'purple' });
    }
    if (features.powercoreYellow) {
      cores.push({ zoneId: node.id, zoneName: node.data.zoneName, type: node.data.type, expiresAt: features.powercoreTimerYellow || 0, coreType: 'yellow' });
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

const activeResources = computed(() => {
  const result = {
    fibre:   [] as { zoneId: string; zoneName: string; tier: number; type: ZoneType; size?: 'S' | 'L' }[],
    leather: [] as { zoneId: string; zoneName: string; tier: number; type: ZoneType; size?: 'S' | 'L' }[],
    ore:     [] as { zoneId: string; zoneName: string; tier: number; type: ZoneType; size?: 'S' | 'L' }[],
    stone:   [] as { zoneId: string; zoneName: string; tier: number; type: ZoneType; size?: 'S' | 'L' }[],
    wood:    [] as { zoneId: string; zoneName: string; tier: number; type: ZoneType; size?: 'S' | 'L' }[],
  };
  flowNodes.value.forEach(node => {
    const f = node.data.features as NodeFeatures | undefined;
    if (!f) return;
    const z = { zoneId: node.id, zoneName: node.data.zoneName, tier: node.data.tier ?? 0, type: node.data.type as ZoneType };
    if (f.resourceFibre)   result.fibre.push({ ...z, size: f.resourceFibreSize });
    if (f.resourceLeather) result.leather.push({ ...z, size: f.resourceLeatherSize });
    if (f.resourceOre)     result.ore.push({ ...z, size: f.resourceOreSize });
    if (f.resourceStone)   result.stone.push({ ...z, size: f.resourceStoneSize });
    if (f.resourceWood)    result.wood.push({ ...z, size: f.resourceWoodSize });
  });
  result.fibre.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
  result.leather.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
  result.ore.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
  result.stone.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
  result.wood.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
  return result;
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
    setCenter(centerX, centerY, { zoom: 1.5, duration: 800 });
    showMobileSummary.value = false;

    // Apply brief glow — removed via animationend to avoid snap on duration change
    node.data.highlighted = true;
    setTimeout(() => {
      node.data.highlighted = false;
    }, 5000);
  }
}

function handleToZoneChange(id: string) {
  if (!ghostNode.value) return;
  const zone = ZONE_BY_ID.get(id);
  const isRoads = !id || zone?.type === 'roads' || zone?.type === 'roadsHideout';
  
  const oldType = ghostNode.value.type;
  const newType = isRoads ? 'zone' : 'non-roads';

  if (oldType !== newType) {
    if (newType === 'non-roads') {
      ghostNode.value.position.x += 100;
      ghostNode.value.position.y += 100;
    } else {
      ghostNode.value.position.x -= 100;
      ghostNode.value.position.y -= 100;
    }
    // Keep targetPosition in sync with the ghost node's updated position
    reportForm.value?.setTargetPosition({ x: ghostNode.value.position.x, y: ghostNode.value.position.y });
  }
  
  ghostNode.value.type = newType;
  ghostNode.value.data = {
    ...ghostNode.value.data,
    zoneName: zone?.name ?? (id || 'Pending...'),
    type: zone?.type ?? (id ? 'other' : 'roadsHideout'),
    tier: zone?.tier ?? 0,
    mapShape: zone?.mapShape,
  };
}

function handleSuccess(msg: string) {
  showToast(msg);
  removeGhost();
}

function handleReportClose() {
  removeGhost();
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

  // Normalize center-overlay to center
  if (params.sourceHandle === 'center-overlay') params.sourceHandle = 'center';
  if (params.targetHandle === 'center-overlay') params.targetHandle = 'center';

  // Check if source handle is already occupied by ANY connection
  const sourceHandleOccupied = store.connections.find(c => 
    !c.isExpired && (
      (c.fromZoneId === params.source && (c.fromHandleId === params.sourceHandle || (!c.fromHandleId && params.sourceHandle === 'center'))) ||
      (c.toZoneId === params.source && (c.toHandleId === params.sourceHandle || (!c.toHandleId && params.sourceHandle === 'center')))
    )
  );

  if (sourceHandleOccupied) {
    // If it's occupied, it must be the SAME connection (modifying handles)
    if (!((sourceHandleOccupied.fromZoneId === params.source && sourceHandleOccupied.toZoneId === params.target) ||
          (sourceHandleOccupied.toZoneId === params.source && sourceHandleOccupied.fromZoneId === params.target))) {
      showToast("You cannot have multiple connections coming out of a portal.", "error");
      return;
    }
  }

  // Check for existing connection between these two zones (to update it)
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
      if (!tutorialStore.completed && tutorialStore.step === 12) {
        tutorialStore.setStep(13);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update connection.', 'error');
    }
    return;
  }

  if (wouldCreateCycle(store.connections, params.source, params.target)) {
    showToast("This connection would create a cycle.", "error");
    return;
  }

  const sourceNode = getNode.value(params.source);
  const targetNode = getNode.value(params.target);

  if (sourceNode && targetNode) {
     if (params.targetHandle === 'center') {
        updateNodeHandlePosition(params.target, 'center', 'bottom');
     }
  }

  reportForm.value?.setConnection(
    params.source,
    params.sourceHandle,
    params.target,
    params.targetHandle
  );
  reportForm.value?.focusTimeInput();
}

async function updateNodeHandlePosition(nodeId: string, handleId: string, position: 'top' | 'right' | 'bottom' | 'left') {
  const node = nodePositions.value.find(np => np.zoneId === nodeId);
  if (!node) return;
  
  const customHandles = node.customHandles || [];
  const existingHandleIndex = customHandles.findIndex(h => h.id === handleId);
  
  const newHandle = { id: handleId, left: '50%', top: '50%', position };
  
  let newCustomHandles;
  if (existingHandleIndex !== -1) {
    newCustomHandles = [...customHandles];
    newCustomHandles[existingHandleIndex] = { ...newCustomHandles[existingHandleIndex], ...newHandle };
  } else {
    newCustomHandles = [...customHandles, newHandle];
  }
  
  store.updateNodeCustomHandles(nodeId, newCustomHandles);
}

function handleConnectStart(params: OnConnectStartParams & { event?: MouseEvent }) {
  store.isConnecting = true;
  if (!params.nodeId || store.isNodeRestricted(params.nodeId, now.value)) {
    draggingFromNodeId = null;
    draggingFromHandleId = null;
    return;
  }

  if (!params.handleId) {
    draggingFromNodeId = null;
    draggingFromHandleId = null;
    return;
  }
  draggingFromNodeId = params.nodeId ?? null;
  draggingFromHandleId = params.handleId ?? null;
}


function handleConnectEnd(event?: MouseEvent) {
  store.isConnecting = false;
  if (wasConnected) {
    wasConnected = false;
    draggingFromNodeId = null;
    draggingFromHandleId = null;
    return;
  }
  
  const fromNodeId = draggingFromNodeId;
  let fromHandleId = draggingFromHandleId;

  if (fromNodeId && fromHandleId && event) {
     const target = event.target as HTMLElement;
     
     // Check if we dropped on a node but NOT a handle
     const nodeElement = target?.closest?.('.vue-flow__node');
     const handleElement = target?.closest?.('.vue-flow__handle');
     
     if (nodeElement && !handleElement) {
       const targetNodeId = nodeElement.getAttribute('data-id');
       if (targetNodeId && targetNodeId !== fromNodeId) {
          // Snap to center!
          handleConnect({
            source: fromNodeId,
            sourceHandle: fromHandleId,
            target: targetNodeId,
            targetHandle: 'center'
          });
          
          draggingFromNodeId = null;
          draggingFromHandleId = null;
          return;
       }
     }

     const clientX = (event as MouseEvent).clientX;
     const clientY = (event as MouseEvent).clientY;
     const hasValidCoords = typeof clientX === 'number' && !isNaN(clientX) &&
                            typeof clientY === 'number' && !isNaN(clientY);

     const flowCoords = hasValidCoords
       ? screenToFlowCoordinate({ x: clientX, y: clientY })
       : null;

     // Check if handle already has a connection
     const existingConn = store.connections.find(c => 
       !c.isExpired && (
         (c.fromZoneId === fromNodeId && (c.fromHandleId === fromHandleId || (!c.fromHandleId && fromHandleId === 'center'))) ||
         (c.toZoneId === fromNodeId && (c.toHandleId === fromHandleId || (!c.toHandleId && fromHandleId === 'center')))
       )
     );

     if (existingConn) {
       showToast("You cannot have multiple connections coming out of a portal.", "error");
       draggingFromNodeId = null;
       draggingFromHandleId = null;
       return;
     }

     removeGhost();

     const ghostId = `ghost-${Date.now()}`;

     let ghostPos: { x: number; y: number } | undefined = flowCoords
       ? { x: flowCoords.x - 200, y: flowCoords.y - 200 }
       : undefined;

     if (!ghostPos) {
       const sourceNode = nodePositions.value.find(n => n.zoneId === fromNodeId);
       if (sourceNode) {
         const hid = fromHandleId ?? 'center';
         let facing = 'se';
         if (['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].includes(hid)) {
           facing = hid;
         } else if (hid !== 'center') {
           const customHandle = sourceNode.customHandles?.find(h => h.id === hid);
           if (customHandle) facing = getHandleFacing(customHandle.left, customHandle.top);
         }
         const DIST = 300;
         const offsets: Record<string, { dx: number; dy: number }> = {
           n:  { dx: 0,     dy: -DIST },
           s:  { dx: 0,     dy:  DIST },
           e:  { dx: DIST,  dy: 0     },
           w:  { dx: -DIST, dy: 0     },
           ne: { dx: DIST,  dy: -DIST },
           nw: { dx: -DIST, dy: -DIST },
           se: { dx: DIST,  dy:  DIST },
           sw: { dx: -DIST, dy:  DIST },
         };
         const { dx, dy } = offsets[facing] ?? offsets['se'];
         ghostPos = { x: sourceNode.x + dx, y: sourceNode.y + dy };
       } else {
         ghostPos = { x: 300, y: 300 };
       }
     }
     const ghostN: any = {
       id: ghostId,
       type: 'zone',
       // Offset to center the diamond (approx 400x400 total size, but visual diamond is smaller)
       // Actually ZoneNode has min-w-[400px] min-h-[400px]
       position: ghostPos,
       data: { 
         zoneName: 'Pending...',
         type: 'roadsHideout',
         isGhost: true,
         features: {},
         tier: 0,
         isHome: false,
       },
       selectable: false,
       draggable: false,
     };
     
     const ghostE: any = {
       id: `e-${fromNodeId}-${ghostId}`,
       source: fromNodeId,
       target: ghostId,
       sourceHandle: fromHandleId,
       targetHandle: 'center',
       type: 'connection',
       animated: true,
       data: { isGhost: true }
     };

     ghostNode.value = ghostN;
     ghostEdge.value = ghostE;
     flowNodes.value.push(ghostN);
     flowEdges.value.push(ghostE);

     console.log('[RoomView] ghost position before opening form:', ghostN.position);
     reportForm.value?.setFromZoneId(fromNodeId, fromHandleId, ghostN.position);
     reportForm.value?.open();
  }
  
  draggingFromNodeId = null;
  draggingFromHandleId = null;
}


function isHandleOccupied(nodeId: string, handleId: string | null) {
  const normalizedHandleId = handleId === 'center-overlay' ? 'center' : handleId;
  return store.connections.some(c => 
    !c.isExpired && (
      (c.fromZoneId === nodeId && (c.fromHandleId === normalizedHandleId || (!c.fromHandleId && normalizedHandleId === 'center'))) ||
      (c.toZoneId === nodeId && (c.toHandleId === normalizedHandleId || (!c.toHandleId && normalizedHandleId === 'center')))
    )
  );
}

defineExpose({ flowNodes, onNodeDragStop });
</script>

<template>
  <div class="h-screen relative bg-gray-950 text-white">
    <TitleSegment :room-title="roomTitle" :class="Z_INDEX.UI_OVERLAY" @logout="logout" @fit-view="fitView({ padding: 0.2, duration: 300 })" />
    <TopToolbar :nodes="flowNodes" :show-debug="isLocal || showDebugOverride" @select="goToNode" @fit-view="fitView({ padding: 0.2, duration: 300 })" @open-debug="showDebug = true" />

    <ReportForm
      ref="reportForm"
      @success="handleSuccess"
      @error="msg => showToast(msg, 'error')"
      @close="handleReportClose"
      @update:to-zone-id="handleToZoneChange"
    />

    <!-- WS status bar (always visible) -->
    <div class="absolute left-0 right-0 top-0 px-3 py-1 text-xs flex items-center justify-center" :class="[Z_INDEX.HEADER, store.wsStatus === 'connected' ? 'frosted-status-connected' : store.wsStatus === 'connecting' ? 'frosted-status-connecting' : store.wsStatus === 'auth_failed' ? 'frosted-status-auth-failed' : 'frosted-status-disconnected']">
      <span v-if="store.wsStatus === 'connected'">
        ● Connected – Last update
        <span
          class="status-update-time"
          :class="{ 'status-update-flash': lastUpdateFlash }"
        >{{ store.lastUpdate ? formatTime(store.lastUpdate) : '…' }}</span>
      </span>
      <span v-else-if="store.wsStatus === 'connecting'">⟳ Connecting…</span>
      <span v-else-if="store.wsStatus === 'auth_failed'">⚠ Session expired — redirecting to login…</span>
      <span v-else>⚠ Disconnected — reconnecting…</span>
    </div>

    <!-- Graph -->
    <div class="absolute inset-0">

      <VueFlow
        v-model:nodes="flowNodes"
        v-model:edges="flowEdges"
        :node-types="{ zone: markRaw(ZoneNode), 'non-roads': markRaw(NonRoadsNode) }"
        :edge-types="{ connection: markRaw(ConnectionEdge) }"
        :fit-view-on-init="true"
        :min-zoom="0.1"
        :connection-mode="ConnectionMode.Loose"
        class="transition-colors duration-1000 !absolute inset-0"
        :class="megaToastBackgroundActive ? 'bg-red-950' : (pingToastBackgroundActive ? 'bg-blue-950' : 'bg-gray-950')"
        @node-drag-stop="onNodeDragStop"
        @edge-update="onEdgeUpdate"
        @connect="handleConnect"
        @connect-start="handleConnectStart"
        @connect-end="handleConnectEnd"
      >
        <template #connection-line="connectionLineProps">
          <ConnectionLine v-bind="connectionLineProps" :is-occupied="isHandleOccupied(connectionLineProps.sourceNode.id, connectionLineProps.sourceHandle?.id ?? null)" />
        </template>
        <Background />
        <Controls />
      </VueFlow>

      <!-- Ping Toasts -->
      <div class="absolute top-20 md:top-24 left-1/2 -translate-x-1/2 pointer-events-none w-full max-w-[95vw] flex flex-col items-center gap-2 px-4" :class="Z_INDEX.TOAST">
        <TransitionGroup name="ping-toast">
          <MegaToast
            v-for="pt in pingToasts"
            :key="pt.id"
            :visible="true"
            :fading-out="pt.fadingOut"
            :enable-internal-animation="false"
            :fill-duration="4"
            fill-color="rgba(96, 165, 250, 0.35)"
            bg-class="bg-blue-600/30 backdrop-blur-md"
            border-class="border-blue-300"
            @click="pt.nodeId ? goToNode(pt.nodeId) : null"
          >📍 Ping: {{ pt.zoneName }}</MegaToast>
        </TransitionGroup>
      </div>

      <!-- Mega Toast -->
      <div class="absolute top-20 md:top-24 left-1/2 -translate-x-1/2 pointer-events-none w-full max-w-[95vw] flex justify-center px-4" :class="Z_INDEX.TOAST">
        <Transition name="ping-toast">
          <MegaToast
            v-if="megaToastVisible"
            :visible="true"
            :fading-out="false"
            :fill-duration="8"
            fill-color="rgba(252, 165, 165, 0.3)"
            bg-class="bg-red-900/40"
            border-class="border-red-500"
            @click="megaToastNodeId ? goToNode(megaToastNodeId) : null"
          >⚔️ Enemies sighted in {{ megaToastRegion }}!</MegaToast>
        </Transition>
      </div>

      <TopLeftToolbar
        :fibre="activeResources.fibre"
        :leather="activeResources.leather"
        :ore="activeResources.ore"
        :stone="activeResources.stone"
        :wood="activeResources.wood"
        @select="goToNode"
      />
      <TopRightToolbar
        :cores="activeCores"
        :crystals="activeCrystals"
        :dungeons="activeDungeons"
        :chests="activeChests"
        @select="goToNode"
      />
    </div>

    <BottomRightPins
      :show-debug="isLocal || showDebugOverride"
      @open-debug="showDebug = true"
      @open-mobile-summary="showMobileSummary = true"
      @fit-view="fitView({ padding: 0.2, duration: 300 })"
    />

    <Transition name="toast">
      <div v-if="showMobileSummary" class="fixed inset-0 flex items-center justify-center p-4 bg-black/60 md:hidden" @click.self="showMobileSummary = false" :class="Z_INDEX.MOBILE_SUMMARY">
        <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900 rounded-t-xl sticky top-0" :class="Z_INDEX.CONTENT_LOW">
            <h2 class="text-base font-bold uppercase text-gray-400">Room Summary</h2>
            <button class="text-gray-400 hover:text-white text-xl leading-none" @click="showMobileSummary = false">&times;</button>
          </div>
          <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
             <RoomMapFeaturesToolbar 
                :cores="activeCores"
                :crystals="activeCrystals"
                :dungeons="activeDungeons"
                :chests="activeChests"
                always-expanded
                @select="goToNode"
              />
              <RoomResourcesToolbar
                :fibre="activeResources.fibre"
                :leather="activeResources.leather"
                :ore="activeResources.ore"
                :stone="activeResources.stone"
                :wood="activeResources.wood"
                always-expanded
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
        class="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 text-sm text-white shadow-lg flex items-center gap-3 transition-colors"
        :class="[
          Z_INDEX.UI_OVERLAY,
          toastType === 'error' ? 'bg-red-900 border border-red-500' : 'bg-gray-800 border border-gray-600'
        ]"
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
    <TipButton />
    
    <!-- Tutorial Exit -->
    <div 
      v-if="!tutorialStore.completed"
      class="fixed top-4 right-4"
      :class="Z_INDEX.TUTORIAL_EXIT"
    >
      <button 
        class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500 font-medium"
        @click="tutorialStore.setCompleted(true)"
      >
        Exit Tutorial
      </button>
    </div>

    <!-- Tutorial Step 11 -->
    <TutorialTooltip
      v-if="!tutorialStore.completed && tutorialStore.step === 11"
      message="Please add a new zone."
      containerClass="fixed bottom-20 left-1/2 -translate-x-1/2"
      :class="Z_INDEX.OVERLAY"
      textClass="text-xl"
    />

    <!-- Tutorial Step 12 -->
    <TutorialTooltip
      v-if="!tutorialStore.completed && tutorialStore.step === 12"
      message="You are able to drag from one zone's handle to another zone's handle to denote &quot;This North West portal in Zone X links to Zone Y at position South West&quot;. This means you can read the map and roughly know where the portals are without having to spend time trying to find it. Add a link now."
      containerClass="fixed bottom-20 left-1/2 -translate-x-1/2"
      :class="Z_INDEX.OVERLAY"
      textClass="text-base"
    />

    <!-- Tutorial Step 15 -->
    <TutorialTooltip
      v-if="!tutorialStore.completed && tutorialStore.step === 15"
      message="When you add a core or crystal spiders / dungeons, they are added to this summary. Here you can jump to zones that have certain features. Click on one of the zones in the summary to continue."
      textClass="text-md"
      containerClass="fixed top-[325px] right-4 w-64"
      :class="Z_INDEX.OVERLAY"
      pointing="up"
    />

    <!-- Tutorial Step 16 -->
    <TutorialTooltip
      v-if="!tutorialStore.completed && tutorialStore.step === 16"
      message="Tutorial complete! You can access the tutorial again by checking &quot;Show Tutorial&quot; on the Create Room page. If you enjoy the site, please consider donating with the button bottom left ❤️ Press Exit Tutorial top right to finish. Happy navigating!"
      containerClass="fixed bottom-20 left-1/2 -translate-x-1/2"
      :class="Z_INDEX.OVERLAY"
      textClass="text-xl"
    />
  </div>
</template>

<style scoped>
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

.ping-toast-enter-active {
  animation: ping-toast-in 0.3s ease-out forwards;
}
.ping-toast-leave-active {
  animation: ping-toast-out 0.4s ease-in forwards;
}

@keyframes ping-toast-in {
  0% { transform: translateY(-20px) scale(0.8); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}

@keyframes ping-toast-out {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(20px) scale(0.8); opacity: 0; }
}

</style>
