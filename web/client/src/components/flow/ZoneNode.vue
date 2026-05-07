<script setup lang="ts">
import { Position, useVueFlow, Handle } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import { ZoneType, NodeFeatures, CustomHandle, getDefaultHandles, getHandleFacing, DEFAULT_INTERNAL_HANDLES } from 'shared';
import { getBorderBgClass } from '@/utils/zoneStyles';
import { connectionStyle } from '@/utils/connectionStyle';
import { TooltipProvider } from 'reka-ui';
import ZoneHeader from './zone/ZoneHeader.vue';
import ZoneCoresAndReds from './zone/ZoneCoresAndReds.vue';
import ZoneReds from './zone/ZoneReds.vue';
import ZoneFeatures from './zone/ZoneFeatures.vue';
import ZoneMapFeaturesModal from './zone/ZoneMapFeaturesModal.vue';
import ZoneHandleEditor from './zone/ZoneHandleEditor.vue';
import ZoneHandleEditorButton from './zone/ZoneHandleEditorButton.vue';
import TutorialTooltip from '../tutorial/TutorialTooltip.vue';
import { useRoomStore } from '@/stores/useRoomStore';
import { useTutorialStore } from '@/stores/useTutorialStore';
import { storeToRefs } from 'pinia';
import { deleteConnection, deleteNode } from '@/utils/roomOperations';
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
  isGhost?: boolean;
}>>();

const store = useRoomStore();
const { connections, homeZoneId, isConnecting } = storeToRefs(store);
const { updateNodeData } = useVueFlow();
const tutorialStore = useTutorialStore();
const now = inject<Ref<number>>('globalNow', ref(Date.now()));

const isIsolated = computed(() => store.isNodeIsolated(props.id, now.value));
const isExpired = computed(() => store.isNodeExpired(props.id, now.value));
const isRestricted = computed(() => isIsolated.value || isExpired.value);

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

async function saveCustomHandles(newHandles: CustomHandle[]) {
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
    const connectionsToDelete = store.connections.filter(c => {
      if (seenConnIds.has(c.id)) return false;
      const affected =
        (c.fromZoneId === props.id && affectedHandleIds.includes(c.fromHandleId!)) ||
        (c.toZoneId === props.id && affectedHandleIds.includes(c.toHandleId!));
      if (affected) seenConnIds.add(c.id);
      return affected;
    });

    // For each connection, do a recursive delete (same as "Delete this and children")
    for (const conn of connectionsToDelete) {
      try {
        const toDelete = new Set<string>();
        const queue = [conn.id];
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
        console.error('Failed to delete connection for handle:', err);
      }
    }
  }

  store.updateNodeCustomHandles(props.id, newHandles);
  isHandleEditorOpen.value = false;
  if (tutorialStore.step === 5) {
    tutorialStore.setStep(6);
  }
  // @ts-ignore
  if (typeof showToast !== 'undefined') showToast('Handle positions updated');
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

  // Hide disabled handles outside the editor
  return h.filter(handle => !handle.disabled);
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

onClickOutside(mapFeaturesModalContainerRef, (e) => {
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
  powercoreYellow: 20 * 60,
};

const showToast = inject<(msg: string, type?: 'info' | 'error') => void>('showToast');
const showPingToast = inject<(zoneName: string, nodeId?: string) => void>('showPingToast');

const isPinged = ref(false);
const pingKey = ref(0);

function handlePing() {
  isPinged.value = false;
  pingKey.value++;
  requestAnimationFrame(() => {
    isPinged.value = true;
  });
  showPingToast?.(props.data.zoneName || props.id, props.id);
}


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
  const list: { type: string; title: string; icon: string; size?: 'S' | 'L'; isResource: boolean }[] = [];
  
  const allFeatures = [
    { key: 'chest', title: 'Chests', icon: '/images/chest.png' },
    { key: 'treasuresGreen', title: 'Green Treasures', icon: '/images/treasures-green.png' },
    { key: 'treasuresBlue', title: 'Blue Treasures', icon: '/images/treasures-blue.png' },
    { key: 'treasuresYellow', title: 'Yellow Treasures', icon: '/images/treasures-yellow.png' },
    { key: 'resourceFibre', title: 'Fibre', icon: '/images/resource-fibre.png' },
    { key: 'resourceLeather', title: 'Leather', icon: '/images/resource-leather.png' },
    { key: 'resourceOre', title: 'Ore', icon: '/images/resource-ore.png' },
    { key: 'resourceStone', title: 'Stone', icon: '/images/resource-stone.png' },
    { key: 'resourceWood', title: 'Wood', icon: '/images/resource-wood.png' },
    { key: 'crystalCreaturePresent', title: 'Crystal Creature', icon: '/images/crystal.png' },
    { key: 'dungeonStatic', title: 'Static Dungeon', icon: '/images/dungeon-static.png' },
    { key: 'dungeonGroup', title: 'Group Dungeon', icon: '/images/dungeon-group.png' },
  ];

  for (const f of allFeatures) {
    if (features[f.key as keyof NodeFeatures]) {
      const sizeKey = `${f.key}Size` as keyof NodeFeatures;
      const size = features[sizeKey] as 'S' | 'L' | undefined;
      list.push({ type: f.key, title: f.title, icon: f.icon, size, isResource: f.key.startsWith('resource') });
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

function toggleFeature(feature: 'powercoreBlue' | 'powercorePurple' | 'powercoreGreen' | 'powercoreYellow' | 'crystalCreaturePresent' | 'dungeonStatic' | 'dungeonGroup' | 'chest' | 'treasuresGreen' | 'treasuresBlue' | 'treasuresYellow' | 'resourceFibre' | 'resourceLeather' | 'resourceOre' | 'resourceStone' | 'resourceWood') {
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
    // If a resource is being deselected, wipe its size
    if (feature.startsWith('resource') && !features[feature]) {
      const sizeKey = `${feature}Size` as keyof NodeFeatures;
      delete features[sizeKey];
    }
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
  <div class="zone-node relative" ref="zoneNodeRef" :class="{ 'ghost-node': props.data.isGhost }">
    <div :class="[isConnecting ? 'connecting-mode' : '']">
        <template v-if="!isHandleEditorOpen && !isMapFeaturesModalOpen" v-for="handle in handles" :key="handle.id">
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
    <TooltipProvider :delay-duration="300">
      <div 
        :key="pingKey"
        class="text-white text-xs text-center min-w-[400px] min-h-[400px] relative transition-all duration-300"
        :class="[
          hasReds ? 'red-glow' : '',
          props.data.isHome ? 'home-glow' : '',
          props.data.highlighted ? 'goto-glow-animation' : '',
          isPinged ? 'ping-animation' : '',
          props.data.isGhost || isRestricted ? 'opacity-50 grayscale' : ''
        ]"
        @animationend="(e: AnimationEvent) => { if (e.animationName === 'goto-glow') updateNodeData(props.id, { highlighted: false }); if (e.animationName === 'ping-glow') isPinged = false; }"
      >
      <!-- Ping Button (top tip) -->
      <button
        class="absolute left-1/2 -translate-x-1/2 top-6 w-7 h-7 flex items-center justify-center ping-button shadow-lg text-xs pointer-events-auto"
        :class="Z_INDEX.CONTENT_LOW"
        title="Ping this zone"
        @click.stop="handlePing"
      >📍</button>

      <!-- Diamond Shape Background -->
      <div 
        class="absolute inset-0 diamond-shape transition-colors duration-300 pointer-events-none"
        :class="[hasReds ? 'bg-red-500/80' : getBorderBgClass(props.data.type) + '/80', Z_INDEX.NODE_BASE]"
      ></div>
      <div 
        class="absolute inset-[2px] diamond-shape transition-colors duration-300 pointer-events-none"
        :class="[hasReds ? 'bg-red-950/80' : 'bg-gray-800/80', Z_INDEX.NODE_BORDER]"
      ></div>


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

        <!-- Handle Editor Button -->
        <div class="handle-editor-container pointer-events-auto">
          <ZoneHandleEditorButton
            ref="handleEditorButtonRef"
            :map-shape="props.data.mapShape"
            :type="props.data.type"
            @click="openHandleEditor"
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

      </div>

      <!-- Central Content Block -->
      <div class="absolute inset-x-0 top-[37.5%] pointer-events-none flex flex-col items-center" :class="Z_INDEX.CONTENT_LOW">
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

            <hr class="w-[85%] my-2 transition-colors duration-300" :class="hasReds ? 'border-red-500/30' : 'border-gray-700/50'" />

          <!-- Map Features -->
          <div class="nodrag flex flex-col items-center pointer-events-auto" ref="featuresContainerRef">
            <div class="flex items-center justify-center gap-1 mb-1 relative">
              <span class="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Map Features</span>
              <button 
                ref="mapFeaturesButtonRef"
                @click.stop="isMapFeaturesModalOpen = !isMapFeaturesModalOpen"
                @mousedown.stop
                class="zone-button p-1 pointer-events-auto relative"
                :class="Z_INDEX.CONTENT_HIGH"
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
          @toggle="toggleFeature"
          @size="setFeatureSize"
          @close="handleCloseTray"
        />
      </div>


      <ZoneHandleEditor
        v-if="isHandleEditorOpen"
        :zone-name="props.data.zoneName || props.id"
        :initial-handles="getInitialHandles()"
        :is-toggle-mode="props.data.mapShape !== 'rest' && props.data.type !== 'roadsHideout'"
        :is-hideout="props.data.type === 'roadsHideout'"
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
      
    </div>
    </TooltipProvider>
  </div>
</template>

<style scoped>
@import './nodes.css';

.cores-nw-container {
  position: absolute;
  top: 70px;
  left: 100px;
}

.cores-ne-container {
  position: absolute;
  top: 70px;
  right: 100px;
}

.reds-ne-container {
  position: absolute;
  top: 200px;
  right: 2px;
}

.handle-editor-container {
  position: absolute;
  top: 165px;
  left: 60px;
}

</style>
