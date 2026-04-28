<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import { ZoneType, NodeFeatures } from 'shared';
import { ZONE_BUTTON_BG_DEFAULT, ZONE_BUTTON_BG_HAS_REDS, ZONE_BUTTON_HOVER_DEFAULT, ZONE_BUTTON_HOVER_HAS_REDS } from '../../constants/ui';
import ZoneTier from './zone/ZoneTier.vue';
import ZoneHeader from './zone/ZoneHeader.vue';
import ZoneCoresAndReds from './zone/ZoneCoresAndReds.vue';
import ZoneFeatures from './zone/ZoneFeatures.vue';
import ZoneEditorTray from './zone/ZoneEditorTray.vue';
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
const activeEditingCore = ref<'powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | null>(null);
const timerComponentRef = ref<InstanceType<typeof ZoneCoresAndReds> | null>(null);

const isRedsOpen = ref(false);

onClickOutside(timerComponentRef, () => {
  if (activeEditingCore.value) {
    activeEditingCore.value = null;
  }
}, { capture: true });

const MAX_TIMES = {
  powercoreGreen: 5 * 60,
  powercoreBlue: 15 * 60,
  powercorePurple: 30 * 60,
};

const showToast = inject<(msg: string, type?: 'info' | 'error') => void>('showToast');


function formatTimer(expiresAtMs: number | undefined | null): string {
  if (expiresAtMs === undefined || expiresAtMs === null) return '';
  const remaining = Math.max(0, Math.floor((expiresAtMs - now.value) / 1000));
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Update timer value when the active core changes
watch(activeEditingCore, (newCore) => {
  if (!newCore) {
    timerValue.value = '';
    return;
  }
  
  const timerKey = newCore === 'powercoreGreen' ? 'powercoreTimerGreen' : newCore === 'powercoreBlue' ? 'powercoreTimerBlue' : 'powercoreTimerPurple';
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
  
  const timerKey = activeEditingCore.value === 'powercoreGreen' ? 'powercoreTimerGreen' : activeEditingCore.value === 'powercoreBlue' ? 'powercoreTimerBlue' : 'powercoreTimerPurple';
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
  return reds !== undefined && reds !== 0;
});

function toggleFeature(feature: 'powercoreBlue' | 'powercorePurple' | 'powercoreGreen' | 'crystalCreaturePresent' | 'dungeonStatic' | 'dungeonGroup' | 'chest' | 'treasuresGreen' | 'treasuresBlue' | 'treasuresYellow' | 'resourceFibre' | 'resourceLeather' | 'resourceOre' | 'resourceStone' | 'resourceWood') {
  const currentFeatures = props.data.features || {};
  const features = { ...currentFeatures };
  
  if (feature.startsWith('powercore')) {
    const isAlreadyEditing = activeEditingCore.value === feature;
    const timerKey = feature === 'powercoreGreen' ? 'powercoreTimerGreen' : feature === 'powercoreBlue' ? 'powercoreTimerBlue' : 'powercoreTimerPurple';
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
  
  const timerKey = activeEditingCore.value === 'powercoreGreen' ? 'powercoreTimerGreen' : activeEditingCore.value === 'powercoreBlue' ? 'powercoreTimerBlue' : 'powercoreTimerPurple';
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
  const timerKey = activeEditingCore.value === 'powercoreGreen' ? 'powercoreTimerGreen' : activeEditingCore.value === 'powercoreBlue' ? 'powercoreTimerBlue' : 'powercoreTimerPurple';
  const newVal = props.data.features?.[timerKey as keyof NodeFeatures] as number | undefined;
  timerValue.value = formatTimer(newVal);
}

function updateReds(val: number | null | undefined) {
  const features = { ...(props.data.features || {}) };
  if (val === undefined) {
    delete features.reds;
  } else {
    features.reds = val;
  }
  store.updateNodeFeatures(props.id, features);
}

function getBorderClass(type: string): string {
  switch (type) {
    case 'royalBlue': return 'border-blue-500';
    case 'royalYellow': return 'border-yellow-500';
    case 'royalRed': return 'border-red-500';
    case 'outlands': return 'border-[#1f1f1f]';
    case 'roads': return 'border-gray-500';
    default: return 'border-gray-500';
  }
}
</script>

<template>
  <div class="zone-node" ref="zoneNodeRef">
    <div 
      class="border rounded overflow-hidden text-white text-xs px-2 py-3 text-center min-w-[230px] relative transition-all duration-300"
      :class="[
        hasReds ? '!bg-red-950 !border-red-500 red-glow' : '!bg-gray-800',
        !hasReds ? getBorderClass(props.data.type) : '',
        props.data.isHome ? 'shadow-[0_0_10px_rgba(255,255,255,0.5)]' : '',
        props.data.highlighted ? 'goto-glow' : ''
      ]"
    >
      <ZoneTier :tier="props.data.tier" :type="props.data.type as ZoneType" />

      <ZoneHeader 
        :id="props.id"
        :zone-name="props.data.zoneName"
        :is-home="props.data.isHome"
        :type="props.data.type as ZoneType"
        :category="props.data.category"
      />

      <template v-if="showFeatures">
        <ZoneCoresAndReds 
          ref="timerComponentRef"
          :features="props.data.features"
          :active-editing-core="activeEditingCore"
          :now="now"
          :has-reds="hasReds"
          v-model:timer-value="timerValue"
          :is-timer-too-long="isTimerTooLong"
          :is-timer-valid="isTimerValid"
          v-model:is-reds-open="isRedsOpen"
          @toggle="toggleFeature"
          @update:reds="updateReds"
          @save="saveTimer"
          @clear="clearTimer"
          @focus="onTimerFocus"
          @blur="onTimerBlur"
        />

        <ZoneFeatures 
          :active-features="activeFeatures"
          :has-reds="hasReds"
        />

        <!-- Editor Tray Toggle Tab -->
        <button 
          @click.stop="isEditorTrayOpen = !isEditorTrayOpen"
          class="w-full mt-2 py-1.5 transition-colors flex items-center justify-center gap-2"
          :class="[
            isEditorTrayOpen ? 'rounded-t-sm' : 'rounded-sm',
            hasReds ? `${ZONE_BUTTON_BG_HAS_REDS} ${ZONE_BUTTON_HOVER_HAS_REDS} text-red-400` : `${ZONE_BUTTON_BG_DEFAULT} ${ZONE_BUTTON_HOVER_DEFAULT} text-gray-400`
          ]"
        >
          <span class="text-[10px] uppercase font-bold">Edit Map Features</span>
          <div 
            class="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent transition-transform duration-300"
            :class="[
              isEditorTrayOpen ? 'border-b-[6px]' : 'border-t-[6px]',
              hasReds ? 'border-b-red-400 border-t-red-400' : 'border-b-gray-400 border-t-gray-400'
            ]"
          ></div>
        </button>

        <ZoneEditorTray 
          :is-open="isEditorTrayOpen"
          :has-reds="hasReds"
          :features="props.data.features"
          @toggle="toggleFeature"
        />
      </template>
    </div>

    <Handle type="source" :position="Position.Top" id="top" />
    <Handle type="source" :position="Position.Right" id="right" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="source" :position="Position.Left" id="left" />
  </div>
</template>

<style scoped>
:deep(.vue-flow__handle) {
  width: 8px;
  height: 8px;
  background: #aaa;
  z-index: 20;
}

@media (pointer: coarse) {
  :deep(.vue-flow__handle) {
    width: 16px;
    height: 16px;
  }
}

.red-glow {
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.7);
  animation: slow-glow 3s infinite ease-in-out;
}

@keyframes slow-glow {
  0%, 100% {
    box-shadow: 0 0 25px rgba(239, 68, 68, 0.3);
  }
  50% {
    box-shadow: 0 0 25px rgba(239, 68, 68, 0.8);
  }
}

.goto-glow {
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.5) !important;
}
</style>
