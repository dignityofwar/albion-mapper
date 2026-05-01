<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import { ZoneType, NodeFeatures, CustomHandle, getDefaultHandles, DEFAULT_INTERNAL_HANDLES } from 'shared';
import { getHandlePosition, getBorderBgClass } from '@/utils/zoneStyles';
import { connectionStyle } from '@/utils/connectionStyle';
import { TooltipProvider } from 'reka-ui';
import ZoneHeader from './zone/ZoneHeader.vue';
import ZoneCoresAndReds from './zone/ZoneCoresAndReds.vue';
import ZoneReds from './zone/ZoneReds.vue';
import ZoneFeatures from './zone/ZoneFeatures.vue';
import ZoneEditorTray from './zone/ZoneEditorTray.vue';
import ZoneHandleEditor from './zone/ZoneHandleEditor.vue';
import TutorialTooltip from '../tutorial/TutorialTooltip.vue';
import { useRoomStore } from '@/stores/useRoomStore';
import { useTutorialStore } from '@/stores/useTutorialStore';
import { storeToRefs } from 'pinia';
import { deleteConnection } from '@/utils/roomOperations';
import { ref, watch, computed, nextTick, inject, type Ref } from 'vue';
import { onClickOutside } from '@vueuse/core';

const props = defineProps<NodeProps<{ 
  isHome: boolean; 
  tier: number; 
  zoneName: string; 
  type: string; 
  features?: NodeFeatures;
  category?: string;
  highlighted?: boolean;
  mapShape?: string;
  customHandles?: CustomHandle[];
  isGhost?: boolean;
}>>();

const store = useRoomStore();
const { connections, homeZoneId } = storeToRefs(store);
const tutorialStore = useTutorialStore();
const now = inject<Ref<number>>('globalNow', ref(Date.now()));

const isIsolated = computed(() => store.isNodeIsolated(props.id, now.value));
const isExpired = computed(() => store.isNodeExpired(props.id, now.value));
const isRestricted = computed(() => isIsolated.value || isExpired.value);

const isEditorTrayOpen = ref(false);
const handleCloseTray = () => {
  isEditorTrayOpen.value = false;
  if (tutorialStore.step === 6) {
    tutorialStore.setStep(7);
  }
};
const zoneNodeRef = ref<HTMLElement | null>(null);
const isTutorialTooltipReady = ref(false);

const showDeleteOverlay = ref(false);

function handleDelete() {
  const newPositions = store.nodePositions.filter(n => n.zoneId !== props.id);
  store.updateNodePositionsInStore(newPositions);
  showDeleteOverlay.value = false;
}

const activeEditingCore = ref<'powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | 'powercoreYellow' | null>(null);

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

const { onMoveStart, onMoveEnd, onNodeDragStart } = useVueFlow();
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
  isEditorTrayOpen.value = false;
});

onClickOutside(zoneNodeRef, () => {
  if (isViewportMoving.value) return;
  isEditorTrayOpen.value = false;
});

const timerValue = ref('');
const isEditingTimer = ref(false);
const timerComponentRef = ref<InstanceType<typeof ZoneCoresAndReds> | null>(null);
const timerContainerRef = ref<HTMLElement | null>(null);

const isRedsOpen = ref(false);
const isHandleEditorOpen = ref(false);
const handleEditorButtonRef = ref<HTMLElement | null>(null);
const mapFeaturesButtonRef = ref<HTMLElement | null>(null);

watch(isHandleEditorOpen, (val) => {
  if (val && tutorialStore.step === 3) {
    tutorialStore.setStep(4);
  }
});


const showPrompt = computed(() => {
  if (tutorialStore.completed) return false;
  if (props.data.isGhost) return false;
  if (isEditorTrayOpen.value || isHandleEditorOpen.value || isEditingTimer.value) return false;
  return tutorialStore.step === 0 && store.nodePositions.length === 1;
});

const tutorialMessage = computed(() => {
  if (tutorialStore.step === 0) return 'Pull on this handle to add a zone';
  return '';
});

onClickOutside(timerContainerRef, () => {
  if (activeEditingCore.value) {
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
  const list: { type: string; title: string; icon: string }[] = [];
  
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
      list.push({ type: f.key, title: f.title, icon: f.icon });
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
  }
  
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
        timerComponentRef.value?.blur();
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

function openHandleEditor() {
  isHandleEditorOpen.value = true;
}

async function saveCustomHandles(newHandles: CustomHandle[]) {
  // Find disabled handles
  const disabledHandleIds = newHandles.filter(h => h.disabled).map(h => h.id);
  
  if (disabledHandleIds.length > 0) {
    // Find connections using these handles on THIS node
    const connectionsToDelete = store.connections.filter(c => 
      (c.fromZoneId === props.id && disabledHandleIds.includes(c.fromHandleId!)) ||
      (c.toZoneId === props.id && disabledHandleIds.includes(c.toHandleId!))
    );
    
    for (const conn of connectionsToDelete) {
      try {
        await deleteConnection(store.roomId, store.token, conn.id);
      } catch (err) {
        console.error('Failed to delete connection for disabled handle:', err);
      }
    }
  }

  store.updateNodeCustomHandles(props.id, newHandles);
  isHandleEditorOpen.value = false;
  if (tutorialStore.step === 5) {
    tutorialStore.setStep(6);
  }
  if (showToast) showToast('Handle positions updated');
}

function getHandleFacing(left: string, top: string): string {
  const l = parseFloat(left);
  const t = parseFloat(top);
  
  // Points
  if (Math.abs(l - 50) < 0.1 && Math.abs(t) < 0.1) return 'n';
  if (Math.abs(l - 100) < 0.1 && Math.abs(t - 50) < 0.1) return 'e';
  if (Math.abs(l - 50) < 0.1 && Math.abs(t - 100) < 0.1) return 's';
  if (Math.abs(l) < 0.1 && Math.abs(t - 50) < 0.1) return 'w';

  // Sides
  if (l >= 50 && t < 50) return 'ne';
  if (l > 50 && t >= 50) return 'se';
  if (l <= 50 && t > 50) return 'sw';
  return 'nw';
}

function updateReds(val: number | null | undefined) {
  const features = { ...(props.data.features || {}) };
  if (val === undefined) {
    delete features.reds;
    delete features.redsTimer;
  } else {
    features.reds = val;
    // Set/Refresh 30 minute timer
    features.redsTimer = now.value + 30 * 60 * 1000;
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

function getHandleColor(handleId: string) {
  const connection = store.connections.find(c => 
    (c.fromZoneId === props.id && c.fromHandleId === handleId) ||
    (c.toZoneId === props.id && c.toHandleId === handleId)
  );
  if (!connection) return '#bbb';
  
  const remainingMs = new Date(connection.expiresAt).getTime() - now.value;
  const isExpired = connection.isExpired || remainingMs <= 0;
  
  return connectionStyle(remainingMs, isExpired).stroke;
}


const GHOST_FACING_MAP: Record<string, string> = {
  n: 's',
  s: 'n',
  e: 'w',
  w: 'e',
  ne: 'sw',
  sw: 'ne',
  se: 'nw',
  nw: 'se',
};

const customHandles = computed(() => {
  let handles: CustomHandle[];
  if (props.data.customHandles && props.data.customHandles.length > 0) {
    handles = [...props.data.customHandles];
  } else if (props.data.type === 'roadsHideout') {
    handles = [...DEFAULT_INTERNAL_HANDLES];
  } else {
    handles = [...getDefaultHandles(props.data.mapShape)];
  }

  // Ensure any default internal handles that have connections are included in the interactive handles list
  DEFAULT_INTERNAL_HANDLES.forEach(dh => {
    const isUsed = store.connections.some(c => 
      (c.fromZoneId === props.id && c.fromHandleId === dh.id) ||
      (c.toZoneId === props.id && c.toHandleId === dh.id)
    );
    if (isUsed && !handles.some(h => h.id === dh.id)) {
      handles.push(dh);
    }
  });

    return handles
    .map(h => {
      let facing = getHandleFacing(h.left, h.top);
      return {
        ...h,
        position: getHandlePosition(h.left, h.top),
        facing: facing,
        style: { 
          left: `calc(${h.left} - var(--handle-radius))`, 
          top: `calc(${h.top} - var(--handle-radius))`,
          '--handle-color': getHandleColor(h.id)
        }
      };
    });
});

const targetHandleIndex = computed(() => {
  const neHandle = customHandles.value.findIndex(h => h.facing === 'ne');
  if (neHandle !== -1) return neHandle;
  return 0;
});

const seHandleIndex = computed(() => {
  return customHandles.value.findIndex(h => h.facing === 'se');
});

const defaultInternalHandles = computed(() => {
  return DEFAULT_INTERNAL_HANDLES.map(h => {
    let facing = getHandleFacing(h.left, h.top);
    return {
      ...h,
      position: getHandlePosition(h.left, h.top),
      facing: facing,
      style: { 
        left: `calc(${h.left} - var(--handle-radius))`, 
        top: `calc(${h.top} - var(--handle-radius))`,
        '--handle-color': getHandleColor(h.id)
      }
    };
  });
});



// getDefaultHandles removed, now using from 'shared'
</script>

<template>
  <div class="zone-node relative" ref="zoneNodeRef" :class="{ 'ghost-node': props.data.isGhost }">
    <div v-if="isRestricted" class="absolute inset-0 z-[100] cursor-pointer" :class="{ 'bg-transparent': !showDeleteOverlay, 'bg-black/80': showDeleteOverlay }" @click="showDeleteOverlay = true">
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
        class="text-white text-xs text-center min-w-[400px] min-h-[400px] relative transition-all duration-300"
        :class="[
          hasReds ? 'red-glow' : '',
          props.data.isHome ? 'home-glow' : '',
          props.data.highlighted ? 'goto-glow' : '',
          props.data.isGhost || isRestricted ? 'opacity-50 grayscale' : ''
        ]"
      >
      <!-- Diamond Shape Background -->
      <div 
        class="absolute inset-0 diamond-shape transition-colors duration-300 pointer-events-none z-[5]"
        :class="[hasReds ? 'bg-red-500/80' : getBorderBgClass(props.data.type) + '/80']"
      ></div>
      <div 
        class="absolute inset-[2px] diamond-shape transition-colors duration-300 pointer-events-none z-[6]"
        :class="[hasReds ? 'bg-red-950/80' : 'bg-gray-800/80']"
      ></div>


      <div 
        v-if="showFeatures"
        class="absolute top-0 left-0 w-full h-full pointer-events-none z-20"
      >
        <div class="cores-nw-container pointer-events-auto" ref="timerContainerRef">
          <ZoneCoresAndReds 
            ref="timerComponentRef"
            :features="props.data.features"
            :active-editing-core="activeEditingCore"
            :now="now"
            :has-reds="hasReds"
            v-model:timer-value="timerValue"
            :is-timer-too-long="isTimerTooLong"
            :is-timer-valid="isTimerValid"
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

      </div>

      <!-- Central Content Block -->
      <div class="absolute inset-x-0 top-[37.5%] z-10 pointer-events-none flex flex-col items-center">
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
            />

            <hr class="w-full my-2 transition-colors duration-300" :class="hasReds ? 'border-red-500/30' : 'border-gray-700/50'" />

          <!-- Map Features -->
          <div class="flex flex-col items-center pointer-events-auto">
            <div class="flex items-center justify-center gap-1 mb-1 relative">
              <span class="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Map Features</span>
              <button 
                ref="mapFeaturesButtonRef"
                @click.stop="isEditorTrayOpen = !isEditorTrayOpen"
                @mousedown.stop
                class="p-1 rounded hover:bg-white/10 text-gray-500 transition-colors pointer-events-auto"
                title="Edit Map Features"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <TutorialTooltip
                v-if="tutorialStore.step === 6"
                message="Click here to edit map features."
                pointing="left"
                containerClass="absolute left-full ml-2 w-max z-[10000]"
              />
            </div>
            <ZoneFeatures 
              :active-features="activeFeatures"
              :has-reds="hasReds"
            />
          </div>
        </div>
      </div>

      <!-- Edit Handles Button at Middle Bottom -->
      <button 
        v-if="props.data.mapShape && (props.data.type === 'roads' || props.data.type === 'roadsHideout')"
        ref="handleEditorButtonRef"
        class="absolute bottom-[35px] left-1/2 -translate-x-1/2 z-10 px-2 py-1 rounded bg-gray-900/80 hover:bg-gray-700 transition-colors text-gray-300 hover:text-white flex items-center gap-1.5 border border-gray-700 shadow-lg"
        @click.stop="openHandleEditor"
        @mousedown.stop
        title="Edit Handles"
      >
        <div class="w-2.5 h-2.5 rounded-full bg-gray-500 border border-white"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
      </button>

      <ZoneEditorTray 
        :is-open="isEditorTrayOpen"
        :has-reds="hasReds"
        :features="props.data.features"
        @toggle="toggleFeature"
        @close="handleCloseTray"
      />
      
      <ZoneHandleEditor
        v-if="isHandleEditorOpen"
        :zone-name="props.data.zoneName || props.id"
        :initial-handles="props.data.customHandles && props.data.customHandles.length > 0 ? props.data.customHandles : (props.data.type === 'roadsHideout' ? DEFAULT_INTERNAL_HANDLES : getDefaultHandles(props.data.mapShape))"
        :is-toggle-mode="props.data.mapShape !== 'rest'"
        :is-hideout="props.data.type === 'roadsHideout'"
        @save="saveCustomHandles"
        @close="isHandleEditorOpen = false"
      />

      <TutorialTooltip
        v-if="!tutorialStore.completed && tutorialStore.step === 3 && !isHandleEditorOpen && handleEditorButtonRef && isTutorialTooltipReady"
        :message="'Open the handle editor to customize portals'"
        pointing="down"
        bounce
        :style="{ left: '50%', bottom: '75px', transform: 'translateX(-50%)', 'z-index': 2000 }"
      />

      <!-- Handles moved inside the relative container to match diamond coordinates exactly -->
      <template v-for="(handle, index) in customHandles" :key="handle.id">
        <Handle
          type="source"
          :position="handle.position"
          :id="handle.id"
          :style="{ ...handle.style, ...(showPrompt && index === targetHandleIndex ? { '--handle-color': '#2563eb', 'z-index': 2000 } : {}) }"
          :data-facing="handle.facing"
          :class="[
            { 'is-disabled': handle.disabled, 'is-isolated': isRestricted },
          ]"
          :connectable="!handle.disabled && !isRestricted"
        />
        <TutorialTooltip
          v-if="showPrompt && index === targetHandleIndex"
          :message="tutorialMessage"
          pointing="down"
          bounce
          :style="{ position: 'absolute', left: handle.left, top: `calc(${handle.top} - 80px)`, transform: 'translateX(-47%)', 'z-index': 10000 }"
        />
        <TutorialTooltip
          v-if="tutorialStore.step === 4 && index === seHandleIndex"
          message="Click-drag this handle to move the portal. This should reflect roughly the position on the map in game."
          pointing="up"
          containerClass="w-72"
          bounce
          :style="{ position: 'absolute', left: handle.left, top: `calc(${handle.top} + 30px)`, transform: 'translateX(-50%)', 'z-index': 10000 }"
        />
      </template>

      <!-- Default internal handles for pending connections -->
      <Handle 
        v-for="handle in defaultInternalHandles" 
        :key="handle.id"
        type="source" 
        :position="handle.position" 
        :id="handle.id" 
        :style="handle.style"
        :data-facing="handle.facing"
        :class="['!border-orange-700 !border-b-2 !z-30 transition-opacity duration-300', store.showDefaultHandles ? '!opacity-100 !pointer-events-auto' : '!opacity-0 !pointer-events-none', isRestricted ? 'is-isolated' : '']"
      />

      <!-- Legacy center handle for backward compatibility -->
      <Handle
        type="source"
        :position="Position.Top"
        id="center"
        :style="{ left: '50%', top: '50%', opacity: 0, pointerEvents: 'none' }"
        :connectable="false"
      />
    </div>
    </TooltipProvider>
  </div>
</template>

<style scoped>
.zone-node {
  --handle-radius: 16px;
}

:deep(.vue-flow__handle) {
  width: calc(var(--handle-radius) * 2) !important;
  height: calc(var(--handle-radius) * 2) !important;
  background: transparent !important;
  border: none !important;
  z-index: 30;
  margin: 0 !important;
  pointer-events: auto !important;
}

:deep(.vue-flow__handle)::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 50%;
  background-color: var(--handle-color, #bbb);
  border: 2px solid #222;
  border-radius: var(--handle-radius) var(--handle-radius) 0 0;
  transition: background-color 0.2s, border-color 0.2s;
}

:deep(.vue-flow__handle:hover)::after {
  background-color: #fff;
  border-color: #fff;
}

:deep(.vue-flow__handle.is-disabled) {
  pointer-events: none !important;
}

:deep(.vue-flow__handle.is-disabled)::after {
  background-color: transparent !important;
  border: 3px solid #4b5563 !important;
  opacity: 0.8;
  transform: scale(0.75) !important;
}

:deep(.vue-flow__handle[data-facing="n"]) { transform: rotate(0deg) !important; }
:deep(.vue-flow__handle[data-facing="ne"]) { transform: rotate(45deg) !important; }
:deep(.vue-flow__handle[data-facing="e"]) { transform: rotate(90deg) !important; }
:deep(.vue-flow__handle[data-facing="se"]) { transform: rotate(135deg) !important; }
:deep(.vue-flow__handle[data-facing="s"]) { transform: rotate(180deg) !important; }
:deep(.vue-flow__handle[data-facing="sw"]) { transform: rotate(225deg) !important; }
:deep(.vue-flow__handle[data-facing="w"]) { transform: rotate(270deg) !important; }
:deep(.vue-flow__handle[data-facing="nw"]) { transform: rotate(315deg) !important; }

:deep(.vue-flow__handle-content) {
  display: none;
}

@media (pointer: coarse) {
  .zone-node {
    --handle-radius: 20px;
  }
  :deep(.vue-flow__handle) {
    border-width: 3px;
  }
}

.red-glow {
  filter: drop-shadow(0 0 15px rgba(239, 68, 68, 0.7));
  animation: slow-glow 3s infinite ease-in-out;
}

.home-glow {
  filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));
}

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

.goto-glow {
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.5) !important;
}

.cores-nw-container {
  position: absolute;
  top: 50px;
  left: 120px;
}

.reds-ne-container {
  position: absolute;
  top: 87px;
  right: 71px;
}

:deep(.vue-flow__handle.is-isolated)::after {
    background-color: #6b7280 !important;
    border-color: #4b5563 !important;
  }


</style>
