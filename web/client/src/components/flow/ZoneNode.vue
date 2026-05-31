<script setup lang="ts">
import { Position, useVueFlow, Handle } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import { ZoneType, NodeFeatures, CustomHandle, getDefaultHandles, getHandleFacing, rotationStepsToDegrees } from 'shared';
import { getBorderBgClass } from '@/utils/zoneStyles';
import { connectionStyle } from '@/utils/connectionStyle';
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent, TooltipPortal } from 'reka-ui';
import ZoneHeader from './zone/ZoneHeader.vue';
import ZoneCoresAndReds from './zone/ZoneCoresAndReds.vue';
import ZoneReds from './zone/ZoneReds.vue';
import ZoneFeatures from './zone/ZoneFeatures.vue';
import ZoneMapFeaturesModal from './zone/ZoneMapFeaturesModal.vue';
import ZoneChestButton from './zone/ZoneChestButton.vue';
import ZoneChestModal from './zone/ZoneChestModal.vue';
import ZoneHandleEditor from './zone/ZoneHandleEditor.vue';
import ZoneHandleEditorButton from './zone/ZoneHandleEditorButton.vue';
import PingButton from './zone/PingButton.vue';
import RoomMemoryButton from './zone/RoomMemoryButton.vue';
import TutorialTooltip from '../tutorial/TutorialTooltip.vue';
import { useRoomStore } from '@/stores/useRoomStore';
import { useRoomMemoryStore } from '@/stores/useRoomMemoryStore';
import { useTutorialStore } from '@/stores/useTutorialStore';
import { usePlotRouteStore } from '@/stores/usePlotRouteStore';
import { storeToRefs } from 'pinia';
import { deleteConnection, deleteNode, updateConnection } from '@/utils/roomOperations';
import { ref, watch, computed, nextTick, inject, type Ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { Z_INDEX } from '@/constants/Layers';

const props = defineProps<NodeProps<{ 
  isHome: boolean; 
  tier: number; 
  zoneName: string; 
  type: string; 
  features?: NodeFeatures;
  category?: string;
  proximityTo?: string;
  highlighted?: boolean;
  mapShape?: string;
  customHandles?: CustomHandle[];
  rotation?: number;
  isGhost?: boolean;
  explored?: boolean;
}>>();

const store = useRoomStore();
const memoryStore = useRoomMemoryStore();
const plotRouteStore = usePlotRouteStore();
const { connections, homeZoneId, isConnecting } = storeToRefs(store);
const memoryEntry = computed(() => memoryStore.getEntry(props.id));
const { updateNodeData } = useVueFlow();
const tutorialStore = useTutorialStore();
const now = inject<Ref<number>>('globalNow', ref(Date.now()));

const isIsolated = computed(() => store.isNodeIsolated(props.id, now.value));
const isExpired = computed(() => store.isNodeExpired(props.id, now.value));
const isRestricted = computed(() => isIsolated.value || isExpired.value);
const isUnexplored = computed(() => !props.data.isHome && !props.data.isGhost && !props.data.explored);

const isRoadsHideout = computed(() => props.data.type === 'roadsHideout');
const isHovered = ref(false);
const isPlotRouteTarget = computed(() => plotRouteStore.isPlotRouteMode && !props.data.isHome && !props.data.isGhost && isHovered.value);
const isRouteDestination = computed(() => plotRouteStore.destinationZoneId === props.id && plotRouteStore.hasRoute);
const hasCustomHandles = computed(() => (props.data.customHandles?.length ?? 0) > 0);
const needsCustomHandles = computed(() => isRoadsHideout.value && !hasCustomHandles.value);

const isMapFeaturesModalOpen = ref(false);
const isHandleEditorOpen = ref(false);
const mapFeaturesModalContainerRef = ref<HTMLElement | null>(null);
const featuresContainerRef = ref<HTMLElement | null>(null);

function getInitialHandles(): CustomHandle[] {
  let handles = props.data.customHandles || [];
  
  if (handles.length === 0) {
    return getDefaultHandles(props.data.type as ZoneType, props.data.mapShape);
  }
  
  if (props.data.type === 'roadsHideout') {
    // Filter out shape handles for hideouts
    return handles.filter(h => !/^[cfhoptxs]-p\d+$/.test(h.id));
  }
  
  return handles;
}

const handleEditorButtonRef = ref<any>(null);
const mapFeaturesButtonRef = ref<HTMLElement | null>(null);
watch(isHandleEditorOpen, (val) => {
  if (val && tutorialStore.step === 3) {
    tutorialStore.setStep(4);
  }
});

function openHandleEditor() {
  isHandleEditorOpen.value = true;
}

async function saveCustomHandles(newHandles: CustomHandle[], newRotation: number) {
  store.updateNodeRotation(props.id, newRotation);
  updateNodeData(props.id, { rotation: newRotation });

  const currentHandles = getInitialHandles();
  const newHandleIds = new Set(newHandles.map(h => h.id));

  // Handles that were removed entirely (not just disabled)
  const removedHandleIds = currentHandles.filter(h => !newHandleIds.has(h.id)).map(h => h.id);

  // Handles that are disabled in the new set
  const disabledHandleIds = newHandles.filter(h => h.disabled).map(h => h.id);

  const affectedHandleIds = [...new Set([...removedHandleIds, ...disabledHandleIds])];

  if (affectedHandleIds.length > 0) {
    // Find connections using these handles on THIS node (deduplicated)
    const seenConnIds = new Set<string>();
    const affectedConnections = store.connections.filter(c => {
      if (seenConnIds.has(c.id)) return false;
      const affected =
        (c.fromZoneId === props.id && affectedHandleIds.includes(c.fromHandleId!)) ||
        (c.toZoneId === props.id && affectedHandleIds.includes(c.toHandleId!));
      if (affected) seenConnIds.add(c.id);
      return affected;
    });

    for (const conn of affectedConnections) {
      try {
        if (conn.toZoneId === props.id && affectedHandleIds.includes(conn.toHandleId!)) {
          // Redirect the destination handle to center instead of deleting the connection
          await updateConnection(store.roomId, store.token, conn.id, { toHandleId: 'center' });
        } else {
          // Source handle was removed — delete the connection
          await deleteConnection(store.roomId, store.token, conn.id);
        }
      } catch (err) {
        console.error('Failed to update/delete connection for handle:', err);
      }
    }
  }

  store.updateNodeCustomHandles(props.id, newHandles);
  isHandleEditorOpen.value = false;
  if (tutorialStore.step === 5) {
    tutorialStore.setStep(6);
  }
  if (typeof showToast !== 'undefined') showToast('Handle positions updated', 'info', 8000);
}

const handleCloseTray = () => {
  isMapFeaturesModalOpen.value = false;
  if (tutorialStore.step === 6) {
    tutorialStore.setStep(7);
  }
};
const zoneNodeRef = ref<HTMLElement | null>(null);
const isTutorialTooltipReady = ref(false);

const showDeleteOverlay = ref(false);

async function handleDelete() {
  try {
    const nodeConns = store.connections.filter(
      c => c.fromZoneId === props.id || c.toZoneId === props.id
    );

    if (nodeConns.length === 0) {
      // Orphaned node — no connections at all, just remove the position
      await deleteNode(store.roomId, store.token, props.id);
      plotRouteStore.onNodeRemoved(props.id);
    } else {
      // Collect all connections touching this node plus their descendants
      const toDelete = new Set<string>();
      const queue = nodeConns.map(c => c.id);

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
      await deleteNode(store.roomId, store.token, props.id);
      plotRouteStore.onNodeRemoved(props.id);
    }
  } catch (err) {
    console.error('Failed to delete node:', err);
  }
  showDeleteOverlay.value = false;
}

const activeEditingCore = ref<'powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | 'powercoreYellow' | null>(null);

const handles = computed(() => {
  const custom = props.data.customHandles || [];
  const defaults = getDefaultHandles(props.data.type as ZoneType, props.data.mapShape);
  
  const h = [...custom];
  // Only merge defaults if no custom handles have been saved yet.
  // If customHandles is non-empty, the user has explicitly configured handles
  // (including deletions), so we must not add defaults back.
  if (custom.length === 0) {
    for (const def of defaults) {
      if (!h.find(c => c.id === def.id)) {
        h.push(def);
      }
    }
  }
  
  const center = h.find(h => h.id === 'center');
  if (!center) {
    h.push({ id: 'center', left: '50%', top: '50%', position: Position.Right });
  }

  // Add overlay handle if connecting to allow for easy center snapping
  if (isConnecting.value) {
    h.push({ id: 'center-overlay', left: '50%', top: '50%', position: Position.Right });
  }

  // Keep disabled handles visible but non-interactive (shown as hollow/greyed out)
  return h;
});

function getHandlePosition(left: string, top: string) {
  const facing = getHandleFacing(left, top);
  if (facing === 'n') return Position.Top;
  if (facing === 's') return Position.Bottom;
  if (facing === 'w') return Position.Left;
  return Position.Right;
}

watch(() => tutorialStore.step, (step) => {
  if (step === 3) {
    isTutorialTooltipReady.value = false;
    setTimeout(() => {
      isTutorialTooltipReady.value = true;
    }, 1000);
  } else {
    isTutorialTooltipReady.value = false;
  }
});

watch(activeEditingCore, (newVal, oldVal) => {
  if (tutorialStore.completed) return;
  
  if (newVal === 'powercoreGreen' && tutorialStore.step === 7) {
    tutorialStore.setStep(8);
  }
  
  if (oldVal === 'powercoreGreen' && newVal === null && tutorialStore.step === 8) {
    tutorialStore.setStep(9);
  }
});

const hoveredHandleId = ref<string | null>(null);

const { onMoveStart, onMoveEnd, onNodeDragStart, onConnectStart, onConnectEnd, updateNode } = useVueFlow();

watch(isMapFeaturesModalOpen, (val) => {
  updateNode(props.id, { zIndex: val ? 9999 : 0 });
});

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
  if (plotRouteStore.plottedConnectionIds.has(conn.id)) return 'handle-edge-plotted';
  if (isRestricted.value || store.isEdgeIsolated(conn.id, now.value)) return 'handle-edge-grey';
  const remainingMs = new Date(conn.expiresAt).getTime() - now.value;
  const style = connectionStyle(remainingMs, conn.isExpired ?? false);
  if (style.stroke === '#0ee25e') return 'handle-edge-green';
  if (style.stroke === '#f59e0b') return 'handle-edge-orange';
  if (style.stroke === '#ef4444') return 'handle-edge-red';
  return 'handle-edge-grey';
};
const isViewportMoving = ref(false);
onMoveStart(() => {
  isViewportMoving.value = true;
});
onMoveEnd(() => {
  setTimeout(() => {
    isViewportMoving.value = false;
  }, 50);
});

onNodeDragStart(() => {
  isMapFeaturesModalOpen.value = false;
});

onConnectStart((params) => {
  isMapFeaturesModalOpen.value = false;
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

onClickOutside(mapFeaturesModalContainerRef, (_) => {
  if (!isMapFeaturesModalOpen.value) return;
  if (isViewportMoving.value) return;
  isMapFeaturesModalOpen.value = false;
}, { ignore: [featuresContainerRef] });

const timerValue = ref('');
const isEditingTimer = ref(false);
const timerComponentRefNW = ref<InstanceType<typeof ZoneCoresAndReds> | null>(null);
const timerComponentRefNE = ref<InstanceType<typeof ZoneCoresAndReds> | null>(null);
const timerContainerRefNW = ref<HTMLElement | null>(null);
const timerContainerRefNE = ref<HTMLElement | null>(null);

const isRedsOpen = ref(false);
const isChestModalOpen = ref(false);
const chestModalContainerRef = ref<HTMLElement | null>(null);

onClickOutside(chestModalContainerRef, () => {
  if (isChestModalOpen.value) isChestModalOpen.value = false;
});

function saveChest(size: 'S' | 'M' | 'L', timerValue: string) {
  const match = timerValue.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return;
  const m = parseInt(match[1], 10);
  const s = parseInt(match[2], 10);
  const totalSeconds = m * 60 + s;
  const currentFeatures = props.data.features || {};
  store.updateNodeFeatures(props.id, {
    ...currentFeatures,
    timedChest: { size, timer: now.value + totalSeconds * 1000 },
  });
}

function clearChest() {
  const currentFeatures = { ...(props.data.features || {}) };
  delete currentFeatures.timedChest;
  store.updateNodeFeatures(props.id, currentFeatures);
}


const showPrompt = computed(() => {
  if (tutorialStore.completed) return false;
  if (props.data.isGhost) return false;
  if (isMapFeaturesModalOpen.value || isEditingTimer.value) return false;
  return tutorialStore.step === 0 && store.nodePositions.length === 1;
});

const tutorialMessage = computed(() => {
  if (tutorialStore.step === 0) return 'Pull on this handle to add a zone';
  return '';
});

onClickOutside(timerContainerRefNW, (e) => {
  if (activeEditingCore.value && !timerContainerRefNE.value?.contains(e.target as Node)) {
    activeEditingCore.value = null;
  }
}, { capture: true });

onClickOutside(timerContainerRefNE, (e) => {
  if (activeEditingCore.value && !timerContainerRefNW.value?.contains(e.target as Node)) {
    activeEditingCore.value = null;
  }
}, { capture: true });

const MAX_TIMES = {
  powercoreGreen: 5 * 60,
  powercoreBlue: 15 * 60,
  powercorePurple: 30 * 60,
  powercoreYellow: 50 * 60,
};

const showToast = inject<(msg: string, type?: 'info' | 'error', duration?: number) => void>('showToast');
const showPingToast = inject<(zoneName: string, nodeId?: string) => void>('showPingToast');

const isPinged = ref(false);
const pingKey = ref(0);

function handlePing() {
  store.send({ type: 'ping', zoneName: props.data.zoneName || props.id, nodeId: props.id });
}

function handleMarkAsCorrect() {
  const currentFeatures = props.data.features || {};
  store.updateNodeFeatures(props.id, { ...currentFeatures });
}

const lastUpdatedText = computed(() => {
  const ts = props.data.features?.lastUpdatedAt;
  if (!ts) return '';
  const diffMs = now.value - ts;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    const remainingMins = diffMins % 60;
    return remainingMins > 0 ? `${diffHours}h ${remainingMins}m ago` : `${diffHours}h ago`;
  }
  return `${Math.floor(diffHours / 24)}d ago`;
});

const lastUpdatedColor = computed(() => {
  const ts = props.data.features?.lastUpdatedAt;
  if (!ts) return '';
  const diffMs = now.value - ts;
  const diffHours = diffMs / 3600000;
  if (diffHours < 2) return 'text-green-400';
  if (diffHours < 3) return 'text-orange-400';
  return 'text-red-400';
});

watch(() => store.lastPing, (ping) => {
  if (ping && ping.nodeId === props.id) {
    isPinged.value = false;
    pingKey.value++;
    requestAnimationFrame(() => {
      isPinged.value = true;
    });
  }
});


function formatTimer(expiresAtMs: number | undefined | null): string {
  if (expiresAtMs === undefined || expiresAtMs === null) return '';
  const remaining = Math.max(0, Math.floor((expiresAtMs - now.value) / 1000));
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getTimerKey(core: string): string {
  switch (core) {
    case 'powercoreGreen': return 'powercoreTimerGreen';
    case 'powercoreBlue': return 'powercoreTimerBlue';
    case 'powercorePurple': return 'powercoreTimerPurple';
    case 'powercoreYellow': return 'powercoreTimerYellow';
    default: return '';
  }
}

// Update timer value when the active core changes
watch(activeEditingCore, (newCore) => {
  if (!newCore) {
    timerValue.value = '';
    return;
  }
  
  const timerKey = getTimerKey(newCore);
  const val = props.data.features?.[timerKey as keyof NodeFeatures] as number | undefined;
  const formatted = formatTimer(val);
  
  // If we have a value from props, update it.
  // Otherwise keep current (might be auto-filled by toggleFeature)
  if (formatted) {
    timerValue.value = formatted;
  }
});

// Update timer value from external store changes (only if not currently typing)
watch([() => props.data.features, now], ([features, _]) => {
  if (isEditingTimer.value || !activeEditingCore.value) return;
  
  const timerKey = getTimerKey(activeEditingCore.value);
  const val = features?.[timerKey as keyof NodeFeatures] as number | undefined;
  timerValue.value = formatTimer(val);
}, { deep: true });

const isTimerValid = computed(() => {
  const match = timerValue.value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const s = parseInt(match[2], 10);
  return s < 60;
});

const isTimerTooLong = computed(() => {
  if (!activeEditingCore.value || !isTimerValid.value) return false;
  const match = timerValue.value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const m = parseInt(match[1], 10);
  const s = parseInt(match[2], 10);
  const totalSeconds = m * 60 + s;
  const maxSeconds = MAX_TIMES[activeEditingCore.value];
  return totalSeconds > maxSeconds;
});

const showFeatures = computed(() => {
  const type = props.data.type;
  if (!type) return true;
  return !type.startsWith('royal') && type !== 'outlands';
});

const activeFeatures = computed(() => {
  if (!props.data.features) return [];
  const features = props.data.features;
  const upstream = features.upstreamFeatures ?? [];
  const list: { type: string; title: string; icon: string; smallCount?: number; largeCount?: number; count?: number; isResource: boolean; upstream?: boolean }[] = [];
  
  const countableFeatures = [
    { key: 'treasuresGreen',        countKey: 'treasuresGreenCount',  title: 'Green Treasures',   icon: '/images/treasures-green.png' },
    { key: 'treasuresBlue',         countKey: 'treasuresBlueCount',   title: 'Blue Treasures',    icon: '/images/treasures-blue.png' },
    { key: 'treasuresYellow',       countKey: 'treasuresYellowCount', title: 'Yellow Treasures',  icon: '/images/treasures-yellow.png' },
    { key: 'crystalCreaturePresent',countKey: null,                   title: 'Crystal Creature',  icon: '/images/crystal.png' },
    { key: 'dungeonStatic',         countKey: 'dungeonStaticCount',   title: 'Static Dungeon',    icon: '/images/dungeon-static.png' },
    { key: 'dungeonGroup',          countKey: 'dungeonGroupCount',    title: 'Group Dungeon',     icon: '/images/dungeon-group.png' },
  ];

  const resourceMeta: Record<string, { title: string; icon: string }> = {
    fibre:   { title: 'Fibre',   icon: '/images/resource-fibre.png' },
    leather: { title: 'Leather', icon: '/images/resource-leather.png' },
    ore:     { title: 'Ore',     icon: '/images/resource-ore.png' },
    stone:   { title: 'Stone',   icon: '/images/resource-stone.png' },
    wood:    { title: 'Wood',    icon: '/images/resource-wood.png' },
  };

  for (const entry of (features.resources ?? [])) {
    const meta = resourceMeta[entry.type];
    if (!meta) continue;
    const smallCount = entry.small ?? 0;
    const largeCount = entry.large ?? 0;
    const isUpstream = upstream.includes(entry.type);
    if (smallCount > 0 || largeCount > 0 || isUpstream) {
      list.push({ type: entry.type, title: meta.title, icon: meta.icon, smallCount, largeCount, isResource: true, upstream: isUpstream && smallCount === 0 && largeCount === 0 });
    }
  }

  for (const f of countableFeatures) {
    const isBoolean = f.countKey === null;
    const countKey = f.countKey ?? '';
    const count = countKey ? ((features[countKey as keyof NodeFeatures] as number | undefined) ?? 0) : 0;
    const booleanVal = isBoolean ? (features[f.key as keyof NodeFeatures] as boolean | undefined) : false;
    
    const upstreamKey = isBoolean ? f.key : countKey;
    const isUpstream = upstream.includes(upstreamKey);
    
    const active = (isBoolean ? booleanVal : count > 0) || isUpstream;
    
    if (active) {
      list.push({ 
        type: f.key, 
        title: f.title, 
        icon: f.icon, 
        count: isBoolean ? undefined : count, 
        isResource: false, 
        upstream: isUpstream && (isBoolean ? !booleanVal : count === 0) 
      });
    }
  }
  return list;
});

const hasReds = computed(() => {
  const reds = props.data.features?.reds;
  const redsTimer = props.data.features?.redsTimer;
  if (redsTimer && redsTimer <= now.value) return false;
  return reds !== undefined && reds !== 0;
});

const diamondOuterClass = computed(() => {
  const classes: string[] = [Z_INDEX.NODE_BASE];

  if (hasReds.value) {
    classes.push('bg-red-500/80');
  } else if (props.data.isHome && !hasReds.value) {
    classes.push('bg-green-500');
  } else {
    classes.push(getBorderBgClass(props.data.type));
  }
  return classes;
});

const diamondInnerClass = computed(() => {
  const classes: string[] = [Z_INDEX.NODE_BORDER];

  if (hasReds.value) {
    classes.push('bg-red-950/80');
  } else {
    classes.push('bg-gray-800');
  }

  return classes;
});

function toggleFeature(feature: 'powercoreBlue' | 'powercorePurple' | 'powercoreGreen' | 'powercoreYellow' | 'crystalCreaturePresent' | 'dungeonStatic' | 'dungeonGroup') {
  const currentFeatures = props.data.features || {};
  const features = { ...currentFeatures };
  
  if (feature.startsWith('powercore')) {
    const isAlreadyEditing = activeEditingCore.value === feature;
    const timerKey = getTimerKey(feature);
    const expiresAt = features[timerKey as keyof NodeFeatures] as number | undefined;
    const isExpired = expiresAt && expiresAt <= now.value;

    if (isAlreadyEditing) {
      if (isExpired) {
        // If expired, reset to max instead of toggling off
        const maxSeconds = MAX_TIMES[feature as keyof typeof MAX_TIMES];
        features[feature] = true;
        features[timerKey as keyof NodeFeatures] = (now.value + maxSeconds * 1000) as any;
        const m = Math.floor(maxSeconds / 60);
        const s = maxSeconds % 60;
        timerValue.value = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      } else {
        // If already active core is clicked and not expired, do nothing.
        // User must use 'X' to clear.
        return;
      }
    } else {
      // If a different core is clicked, select it for editing and ensure it's ON
      features[feature] = true;
      activeEditingCore.value = feature as any;

      // Auto-fill max time ONLY IF no valid timer exists
      if (!expiresAt || isExpired) {
        const maxSeconds = MAX_TIMES[feature as keyof typeof MAX_TIMES];
        features[timerKey as keyof NodeFeatures] = (now.value + maxSeconds * 1000) as any;

        // Update local timerValue for immediate feedback
        const m = Math.floor(maxSeconds / 60);
        const s = maxSeconds % 60;
        timerValue.value = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
    }
  } else {
    features[feature] = !features[feature];
  }
  
  store.updateNodeFeatures(props.id, features);
}

function setFeatureSize(type: keyof NodeFeatures, size: 'S' | 'L') {
  const currentFeatures = props.data.features || {};
  const features: any = { ...currentFeatures };
  const sizeKey = `${type}Size` as keyof NodeFeatures;
  features[sizeKey] = size;
  features[type] = true;
  store.updateNodeFeatures(props.id, features);
}

function setFeatureCount(type: string, count: number) {
  const countKey = `${type}Count` as keyof NodeFeatures;
  const currentFeatures = props.data.features || {};
  const features: any = { ...currentFeatures };
  if (count > 0) {
    features[countKey] = count;
  } else {
    delete features[countKey];
  }
  // Clear upstream marker when user explicitly sets a count
  if (features.upstreamFeatures) {
    features.upstreamFeatures = features.upstreamFeatures.filter((k: string) => k !== String(countKey));
    if (features.upstreamFeatures.length === 0) delete features.upstreamFeatures;
  }
  store.updateNodeFeatures(props.id, features);
}

function setResourceCount(type: string, size: 'small' | 'large', count: number) {
  const currentFeatures = props.data.features || {};
  const resources = [...(currentFeatures.resources ?? [])];
  const idx = resources.findIndex(r => r.type === type);
  if (idx >= 0) {
    const updated = { ...resources[idx], [size]: count > 0 ? count : undefined };
    if (!updated.small && !updated.large) {
      resources.splice(idx, 1);
    } else {
      resources[idx] = updated;
    }
  } else if (count > 0) {
    resources.push({ type: type as any, [size]: count });
  }
  // Clear upstream marker when user explicitly sets a resource count
  let upstreamFeatures = currentFeatures.upstreamFeatures ? [...currentFeatures.upstreamFeatures] : undefined;
  if (upstreamFeatures) {
    upstreamFeatures = upstreamFeatures.filter(k => k !== type);
    if (upstreamFeatures.length === 0) upstreamFeatures = undefined;
  }
  store.updateNodeFeatures(props.id, { ...currentFeatures, resources, upstreamFeatures });
}

function clearResource(type: string) {
  const currentFeatures = props.data.features || {};
  const resources = [...(currentFeatures.resources ?? [])];
  const idx = resources.findIndex(r => r.type === type);
  if (idx >= 0) {
    resources.splice(idx, 1);
    
    // Clear upstream marker
    let upstreamFeatures = currentFeatures.upstreamFeatures ? [...currentFeatures.upstreamFeatures] : undefined;
    if (upstreamFeatures) {
      upstreamFeatures = upstreamFeatures.filter(k => k !== type);
      if (upstreamFeatures.length === 0) upstreamFeatures = undefined;
    }
    store.updateNodeFeatures(props.id, { ...currentFeatures, resources, upstreamFeatures });
  }
}


function saveTimer() {
  if (!activeEditingCore.value) return;
  
  if (isTimerTooLong.value) {
    showToast?.('The timer is too long', 'error');
    return;
  }
  
  const timerKey = getTimerKey(activeEditingCore.value);
  const currentFeatures = { ...(props.data.features || {}) };

  if (timerValue.value === '') {
    delete currentFeatures[timerKey as keyof NodeFeatures];
    if (activeEditingCore.value) {
      delete currentFeatures[activeEditingCore.value as keyof NodeFeatures];
    }
    store.updateNodeFeatures(props.id, currentFeatures);
    activeEditingCore.value = null;
    return;
  }

  const match = timerValue.value.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const m = parseInt(match[1], 10);
    const s = parseInt(match[2], 10);
    if (s < 60) {
      currentFeatures[timerKey as keyof NodeFeatures] = (now.value + (m * 60 + s) * 1000) as any;
      store.updateNodeFeatures(props.id, currentFeatures);
      
      // Blur the input after saving
      nextTick(() => {
        timerComponentRefNW.value?.blur();
        timerComponentRefNE.value?.blur();
      });
      activeEditingCore.value = null;
    }
  }
}

function clearTimer() {
  if (!activeEditingCore.value) return;
  timerValue.value = '';
  saveTimer();
  activeEditingCore.value = null;
}

function onTimerFocus() {
  isEditingTimer.value = true;
}

function onTimerBlur() {
  isEditingTimer.value = false;
  // Reset to formatted value from store
  if (!activeEditingCore.value) {
    timerValue.value = '';
    return;
  }
  const timerKey = getTimerKey(activeEditingCore.value);
  const newVal = props.data.features?.[timerKey as keyof NodeFeatures] as number | undefined;
  timerValue.value = formatTimer(newVal);
}

// ...


function updateReds(val: number | null | undefined) {
  const features = { ...(props.data.features || {}) };
  if (val === undefined) {
    delete features.reds;
    delete features.redsTimer;
  } else {
    features.reds = val;
    // Set/Refresh 15 minute timer
    features.redsTimer = now.value + 15 * 60 * 1000;
  }
  store.updateNodeFeatures(props.id, features);
}

function unlockCore(core: string) {
  const timerKey = getTimerKey(core);
  const features = { ...(props.data.features || {}) };
  // Set timer to current time so it's considered expired (unlocked)
  features[timerKey as keyof NodeFeatures] = now.value as any;
  store.updateNodeFeatures(props.id, features);
  
  if (activeEditingCore.value === core) {
    timerValue.value = '';
    activeEditingCore.value = null;
  }
}

function isInsideDiamond(e: MouseEvent): boolean {
  const el = zoneNodeRef.value;
  if (!el) return true;
  const rect = el.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  return Math.abs(x - cx) + Math.abs(y - cy) <= cx;
}

function onNodeMouseDown(e: MouseEvent) {
  // Allow events from interactive children (buttons, inputs, handles) regardless of position
  const target = e.target as HTMLElement;
  if (target.closest('button, input, .vue-flow__handle, .nodrag')) return;
  if (!isInsideDiamond(e)) {
    e.stopPropagation();
  }
}

function lockCore(core: string) {
  const timerKey = getTimerKey(core);
  const features = { ...(props.data.features || {}) };
  const maxSeconds = MAX_TIMES[core as keyof typeof MAX_TIMES];
  features[timerKey as keyof NodeFeatures] = (now.value + maxSeconds * 1000) as any;
  store.updateNodeFeatures(props.id, features);
  
  if (activeEditingCore.value === core) {
    const m = Math.floor(maxSeconds / 60);
    const s = maxSeconds % 60;
    timerValue.value = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
</script>

<template>
  <div class="zone-node relative" ref="zoneNodeRef" :class="{ 'ghost-node': props.data.isGhost }" @mousedown="onNodeMouseDown">
    <div :class="[isConnecting ? 'connecting-mode' : '']">
        <template v-if="!isHandleEditorOpen && !isMapFeaturesModalOpen && !isChestModalOpen" v-for="handle in handles" :key="handle.id">
          <div
            v-if="handle.disabled"
            class="handle absolute"
            :class="[
              Z_INDEX.HANDLE,
              `facing-${getHandleFacing(handle.left, handle.top)}`,
              'is-disabled'
            ]"
            :style="{ left: handle.left, top: handle.top }"
          />
          <Handle
            v-else
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
    
    <div v-if="isRestricted" class="absolute inset-0 cursor-pointer diamond-shape" :class="[Z_INDEX.RESTRICTED_NODE, { 'bg-transparent': !showDeleteOverlay, 'bg-black/80': showDeleteOverlay }]" @click="showDeleteOverlay = true">
       <div v-if="showDeleteOverlay" class="flex flex-col items-center justify-center h-full rounded-lg" @click.stop>
         <p class="text-white mb-4">Node is expired. Delete it?</p>
         <div class="flex gap-2">
           <button @click.stop="handleDelete" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">Delete</button>
           <button @click.stop="showDeleteOverlay = false" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded">Cancel</button>
         </div>
       </div>
    </div>

    <div v-if="isUnexplored && !isRestricted" class="absolute inset-0 pointer-events-none flex items-center justify-center" :class="Z_INDEX.RESTRICTED_NODE">
      <div class="absolute inset-0 bg-gray-900/70 diamond-shape"></div>
      <span class="relative text-[18px] font-semibold tracking-widest border-dashed border uppercase text-white select-none mt-48 bg-gray-700 px-3 py-1 rounded-xl">Unexplored</span>
    </div>
    <TooltipProvider :delay-duration="0">
      <div 
        :key="pingKey"
        class="text-white text-xs text-center min-w-[400px] min-h-[400px] relative transition-all duration-300"
        :class="[
          hasReds ? 'red-glow' : '',
          props.data.isHome ? 'home-glow' : '',
          props.data.highlighted ? 'goto-glow-animation' : '',
          isPinged ? 'ping-animation' : '',
          props.data.isGhost || isRestricted ? 'opacity-50 grayscale' : '',
          isPlotRouteTarget && store.animationsEnabled ? 'plot-route-hover' : (isPlotRouteTarget ? 'plot-route-hover-static' : ''),
          isRouteDestination && store.animationsEnabled ? 'plot-route-destination' : (isRouteDestination ? 'plot-route-destination-static' : '')
        ]"
        @animationend="(e: AnimationEvent) => { if (e.animationName === 'goto-glow') updateNodeData(props.id, { highlighted: false }); if (e.animationName === 'ping-glow' || e.animationName === 'ping-glow-home') isPinged = false; }"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false"
      >
      <!-- Ping Button (top tip) -->
      <div class="absolute left-1/2 -translate-x-1/2 top-9 flex flex-col items-center gap-0.5" :class="Z_INDEX.CONTENT_MID">
        <div class="flex items-center gap-1">
          <PingButton :has-reds="hasReds" @ping="handlePing" />
          <TooltipRoot>
            <TooltipTrigger asChild>
              <button
                :class="['w-9 h-9 flex items-center justify-center zone-button round-button check-button shadow-lg text-lg pointer-events-auto', hasReds ? 'zone-button-reds' : '']"
                @click.stop="handleMarkAsCorrect"
              >✅</button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent class="bg-black text-white text-xs px-2 py-1 rounded shadow-lg z-[10000]">
                Mark as correct
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>
        </div>
        <span v-if="props.data.features?.lastUpdatedAt" class="text-[10px] font-semibold pointer-events-none select-none" :class="lastUpdatedColor">
          Updated: {{ lastUpdatedText }}
        </span>
      </div>

      <!-- Diamond Shape Background -->
      <div 
        class="absolute inset-0 diamond-shape transition-colors duration-300 pointer-events-none"
        :class="diamondOuterClass"
      ></div>
      <div 
        class="absolute inset-[4px] diamond-shape transition-colors duration-300 pointer-events-none"
        :class="diamondInnerClass"
      ></div>

      <!-- Shape Image Overlay -->
      <img
        v-if="props.data.mapShape && props.data.mapShape !== 'rest'"
        :src="`/images/shapes/${props.data.mapShape}.png`"
        class="absolute w-full h-full p-1.5 object-contain pointer-events-none"
        :class="Z_INDEX.CONTENT_LOW"
        :style="{
          opacity: isHandleEditorOpen ? 1 : (store.shapeBackgroundOpacity / 100),
          ...(props.data.rotation ? { transform: `rotate(${rotationStepsToDegrees(props.data.rotation)}deg)` } : {})
        }"
        alt=""
      />

      <div 
        v-if="showFeatures"
        class="absolute top-0 left-0 w-full h-full pointer-events-none" :class="Z_INDEX.CONTENT_MID"
      >
        <div class="cores-nw-container pointer-events-auto" ref="timerContainerRefNW">
          <ZoneCoresAndReds 
            ref="timerComponentRefNW"
            :features="props.data.features"
            :active-editing-core="activeEditingCore"
            :now="now"
            :has-reds="hasReds"
            v-model:timer-value="timerValue"
            :is-timer-too-long="isTimerTooLong"
            :is-timer-valid="isTimerValid"
            :cores="['powercoreGreen', 'powercoreBlue']"
            side="left"
            @toggle="toggleFeature"
            @save="saveTimer"
            @clear="clearTimer"
            @focus="onTimerFocus"
            @blur="onTimerBlur"
            @unlock="unlockCore"
            @lock="lockCore"
          />
        </div>

        <div class="cores-ne-container pointer-events-auto" ref="timerContainerRefNE">
          <ZoneCoresAndReds 
            ref="timerComponentRefNE"
            :features="props.data.features"
            :active-editing-core="activeEditingCore"
            :now="now"
            :has-reds="hasReds"
            v-model:timer-value="timerValue"
            :is-timer-too-long="isTimerTooLong"
            :is-timer-valid="isTimerValid"
            :cores="['powercorePurple', 'powercoreYellow']"
            side="right"
            @toggle="toggleFeature"
            @save="saveTimer"
            @clear="clearTimer"
            @focus="onTimerFocus"
            @blur="onTimerBlur"
            @unlock="unlockCore"
            @lock="lockCore"
          />
        </div>

        <!-- Reds on North-East Edge -->
        <div class="reds-ne-container pointer-events-auto">
          <ZoneReds 
            :reds="props.data.features?.reds"
            :reds-timer="props.data.features?.redsTimer"
            :now="now"
            v-model:is-open="isRedsOpen"
            @update:reds="updateReds"
          />
        </div>

        <!-- Chest on South-West Edge (opposite of Reds) -->
        <div class="chest-sw-container pointer-events-auto">
          <ZoneChestButton
            :timed-chest="props.data.features?.timedChest"
            :now="now"
            :has-reds="hasReds"
            @click="isChestModalOpen = !isChestModalOpen"
          />
        </div>
      </div>

      <!-- Handle Editor Button -->
      <div v-if="!isHandleEditorOpen && !isMapFeaturesModalOpen && !isChestModalOpen" class="handle-editor-container pointer-events-auto" :class="Z_INDEX.TOAST">
        <ZoneHandleEditorButton
          ref="handleEditorButtonRef"
          :map-shape="props.data.mapShape"
          :type="props.data.type"
          :has-reds="hasReds"
          :needs-custom-handles="needsCustomHandles"
          @click="openHandleEditor"
        />
      </div>

      <!-- Central Content Block -->
      <div class="absolute inset-x-0 top-[42%] pointer-events-none flex flex-col items-center" :class="Z_INDEX.CONTENT_LOW">
        <div class="w-full flex flex-col items-center pointer-events-none">
          <!-- Zone Header -->
            <ZoneHeader
              :id="props.id" 
              :zone-name="props.data.zoneName" 
              :is-home="props.data.isHome" 
              :type="props.data.type as ZoneType" 
              :category="props.data.category"
              :map-shape="props.data.mapShape"
              :tier="props.data.tier"
              :proximity-to="props.data.proximityTo"
            />

          <!-- Map Features -->
          <div class="flex flex-col items-center pointer-events-auto mt-2" ref="featuresContainerRef">
            <div class="flex items-center justify-center gap-1 mb-1 relative">
              <span class="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Map Features</span>
              <button 
                ref="mapFeaturesButtonRef"
                @click.stop="isMapFeaturesModalOpen = !isMapFeaturesModalOpen"
                @mousedown.stop
                :class="['zone-button p-1 pointer-events-auto relative', hasReds ? 'zone-button-reds' : '', Z_INDEX.CONTENT_HIGH]"
                title="Edit Map Features"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
            </div>
            <ZoneFeatures 
              :active-features="activeFeatures"
              :has-reds="hasReds"
              @edit="isMapFeaturesModalOpen = true"
            />
          </div>
        </div>
      </div>

      <div ref="mapFeaturesModalContainerRef">
        <ZoneMapFeaturesModal 
          :is-open="isMapFeaturesModalOpen"
          :has-reds="hasReds"
          :features="props.data.features"
          :upstream-features="props.data.features?.upstreamFeatures ?? []"
          @toggle="toggleFeature"
          @size="setFeatureSize"
          @feature-count="setFeatureCount"
          @resource-count="setResourceCount"
          @clear-resource="clearResource"
          @close="handleCloseTray"
        />
      </div>

      <div ref="chestModalContainerRef">
        <ZoneChestModal
          :is-open="isChestModalOpen"
          :has-reds="hasReds"
          :chest-size="props.data.features?.timedChest?.size"
          :chest-timer="props.data.features?.timedChest?.timer"
          :now="now"
          @save="saveChest"
          @clear="clearChest"
          @close="isChestModalOpen = false"
        />
      </div>


      <ZoneHandleEditor
        v-if="isHandleEditorOpen"
        :zone-name="props.data.zoneName || props.id"
        :initial-handles="getInitialHandles()"
        :is-toggle-mode="props.data.mapShape !== 'rest' && props.data.type !== 'roadsHideout'"
        :is-hideout="props.data.type === 'roadsHideout'"
        :map-shape="props.data.mapShape"
        :initial-rotation="props.data.rotation ?? 0"
        @save="saveCustomHandles"
        @close="isHandleEditorOpen = false"
      />

      <TutorialTooltip
        v-if="!tutorialStore.completed && tutorialStore.step === 3 && !isHandleEditorOpen && handleEditorButtonRef && isTutorialTooltipReady"
        :message="'Open the handle editor to customize portals'"
        pointing="right"
        bounce
        :target="handleEditorButtonRef?.$el ?? undefined"
        :class="[Z_INDEX.HANDLE_OVERLAY]"
      />

      <!-- Room Memory Button (bottom tip) -->
      <div class="absolute left-1/2 -translate-x-1/2 bottom-5 flex items-center justify-center" :class="Z_INDEX.CONTENT_LOW" v-if="!props.data.isHome">
        <RoomMemoryButton :entry="memoryEntry ?? null" :zone-name="props.data.zoneName || props.id" :zone-id="props.id" :has-rotation-error="store.rotationErrors.includes(props.id)" />
      </div>
      
    </div>
    </TooltipProvider>
  </div>
</template>

<style scoped>
@import './nodes.css';

.cores-nw-container {
  position: absolute;
  top: 90px;
  left: 82px;
}

.cores-ne-container {
  position: absolute;
  top: 90px;
  right: 82px;
}

.reds-ne-container {
  position: absolute;
  top: 200px;
  right: 4px;
}

.chest-sw-container {
  position: absolute;
  top: 200px;
  left: 4px;
}

.handle-editor-container {
  position: absolute;
  top: 165px;
  left: 50px;
}

/*noinspection ALL*/
.plot-route-hover {
  animation: plot-route-hover-pulse 1.5s ease-in-out infinite;
}

/*noinspection ALL*/
.plot-route-hover-static {
  filter: drop-shadow(0 0 18px #60a5fa) drop-shadow(0 0 6px #93c5fd);
}

@keyframes plot-route-hover-pulse {
  0%, 100% { filter: drop-shadow(0 0 18px #60a5fa) drop-shadow(0 0 6px #93c5fd); }
  50% { filter: drop-shadow(0 0 6px #1d4ed8) drop-shadow(0 0 2px #3b82f6); }
}

/*noinspection ALL*/
.plot-route-destination {
  animation: plot-route-destination-pulse 5s ease-in-out infinite;
}

/*noinspection ALL*/
.plot-route-destination-static {
  filter: drop-shadow(0 0 20px #1d4ed8) drop-shadow(0 0 8px #1e40af);
}

@keyframes plot-route-destination-pulse {
  0%, 100% { filter: drop-shadow(0 0 20px #1d4ed8) drop-shadow(0 0 8px #1e40af); }
  50% { filter: drop-shadow(0 0 8px #1e3a8a) drop-shadow(0 0 2px #1d4ed8); }
}

</style>
