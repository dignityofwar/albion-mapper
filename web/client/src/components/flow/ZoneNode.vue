<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import { ZoneType, NodeFeatures, CustomHandle, getDefaultHandles, DEFAULT_INTERNAL_HANDLES } from 'shared';
import { ZONE_BUTTON_BG_DEFAULT, ZONE_BUTTON_BG_HAS_REDS, ZONE_BUTTON_HOVER_DEFAULT, ZONE_BUTTON_HOVER_HAS_REDS } from '../../constants/ui';
import { TooltipProvider } from 'reka-ui';
import ZoneHeader from './zone/ZoneHeader.vue';
import ZoneCoresAndReds from './zone/ZoneCoresAndReds.vue';
import ZoneReds from './zone/ZoneReds.vue';
import ZoneFeatures from './zone/ZoneFeatures.vue';
import ZoneEditorTray from './zone/ZoneEditorTray.vue';
import ZoneHandleEditor from './zone/ZoneHandleEditor.vue';
import { useRoomStore } from '../../stores/useRoomStore';
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
}>>();

const store = useRoomStore();
const now = inject<Ref<number>>('globalNow', ref(Date.now()));

const isEditorTrayOpen = ref(false);
const zoneNodeRef = ref<HTMLElement | null>(null);

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
const activeEditingCore = ref<'powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | 'powercoreYellow' | null>(null);
const timerComponentRef = ref<InstanceType<typeof ZoneCoresAndReds> | null>(null);
const timerContainerRef = ref<HTMLElement | null>(null);

const isRedsOpen = ref(false);
const isHandleEditorOpen = ref(false);

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

function saveCustomHandles(newHandles: CustomHandle[]) {
  store.updateNodeCustomHandles(props.id, newHandles);
  isHandleEditorOpen.value = false;
  if (showToast) showToast('Handle positions updated');
}

function getHandlePosition(left: string, top: string): Position {
  const l = parseFloat(left);
  const t = parseFloat(top);
  
  if (l >= 50 && t <= 50) return Position.Top;
  if (l > 50 && t > 50) return Position.Right;
  if (l <= 50 && t > 50) return Position.Bottom;
  return Position.Left;
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

function getBorderBgClass(type: string): string {
  switch (type) {
    case 'royalBlue': return 'bg-blue-500';
    case 'royalYellow': return 'bg-yellow-500';
    case 'royalRed': return 'bg-red-500';
    case 'outlands': return 'bg-[#1f1f1f]';
    case 'roads': return 'bg-gray-500';
    default: return 'bg-gray-500';
  }
}

const customHandles = computed(() => {
  const handles = (props.data.customHandles && props.data.customHandles.length > 0)
    ? props.data.customHandles
    : getDefaultHandles(props.data.mapShape);

  return handles
    .filter(h => !h.disabled)
    .map(h => ({
      ...h,
      position: getHandlePosition(h.left, h.top),
      style: { left: h.left, top: h.top }
    }));
});

const defaultInternalHandles = computed(() => {
  return DEFAULT_INTERNAL_HANDLES.map(h => ({
    ...h,
    position: getHandlePosition(h.left, h.top),
    style: { left: h.left, top: h.top }
  }));
});



// getDefaultHandles removed, now using from 'shared'
</script>

<template>
  <div class="zone-node" ref="zoneNodeRef">
    <TooltipProvider :delay-duration="300">
      <div 
        class="text-white text-xs text-center min-w-[400px] min-h-[400px] relative transition-all duration-300"
        :class="[
          hasReds ? 'red-glow' : '',
          props.data.isHome ? 'home-glow' : '',
          props.data.highlighted ? 'goto-glow' : ''
        ]"
      >
      <!-- Diamond Shape Background -->
      <div 
        class="absolute inset-0 diamond-shape transition-colors duration-300 pointer-events-none"
        :class="[hasReds ? 'bg-red-500' : getBorderBgClass(props.data.type)]"
      ></div>
      <div 
        class="absolute inset-[2px] diamond-shape transition-colors duration-300 pointer-events-none"
        :class="[hasReds ? 'bg-red-950' : 'bg-gray-800']"
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
        <div class="w-full flex flex-col items-center pointer-events-auto">
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
          <div class="flex flex-col items-center">
            <div class="flex items-center justify-center gap-1 mb-1">
              <span class="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Map Features</span>
              <button 
                @click.stop="isEditorTrayOpen = !isEditorTrayOpen"
                @mousedown.stop
                class="p-1 rounded hover:bg-white/10 text-gray-500 transition-colors"
                title="Edit Map Features"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
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
        v-if="props.data.mapShape && props.data.type === 'roads'"
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
        @close="isEditorTrayOpen = false"
      />
      
      <ZoneHandleEditor
        v-if="isHandleEditorOpen"
        :zone-name="props.data.zoneName || props.id"
        :initial-handles="props.data.customHandles && props.data.customHandles.length > 0 ? props.data.customHandles : getDefaultHandles(props.data.mapShape)"
        :is-toggle-mode="props.data.mapShape !== 'rest'"
        @save="saveCustomHandles"
        @close="isHandleEditorOpen = false"
      />

      <!-- Handles moved inside the relative container to match diamond coordinates exactly -->
      <Handle 
        v-for="handle in customHandles" 
        :key="handle.id"
        type="source" 
        :position="handle.position" 
        :id="handle.id" 
        :style="handle.style"
      />

      <!-- Default internal handles for pending connections -->
      <Handle 
        v-for="handle in defaultInternalHandles" 
        :key="handle.id"
        type="source" 
        :position="handle.position" 
        :id="handle.id" 
        :style="handle.style"
        :class="['!bg-orange-500 !border-orange-700 !z-30 transition-opacity duration-300', store.showDefaultHandles ? '!opacity-100 !pointer-events-auto' : '!opacity-0 !pointer-events-none']"
      />

      <!-- Legacy center handle for backward compatibility -->
      <Handle
        type="source"
        :position="Position.Top"
        id="center"
        :style="{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', opacity: 0, pointerEvents: 'none' }"
      />
    </div>
    </TooltipProvider>
  </div>
</template>

<style scoped>
:deep(.vue-flow__handle) {
  width: 16px;
  height: 16px;
  background: #bbb;
  border: 2px solid #222;
  border-radius: 50%;
  z-index: 20;
  transition: background-color 0.2s;
  transform: translate(-50%, -50%);
}

:deep(.vue-flow__handle:hover) {
  background: #fff;
  border-color: #000;
}

@media (pointer: coarse) {
  :deep(.vue-flow__handle) {
    width: 24px;
    height: 24px;
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

</style>
