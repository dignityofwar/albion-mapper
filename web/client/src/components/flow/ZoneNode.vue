<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import type { ZoneType, NodeFeatures } from 'shared';
import TagTier from '../common/TagTier.vue';
import TagZone from '../common/TagZone.vue';
import ZoneFeatureToggle from './zone/ZoneFeatureToggle.vue';
import ZoneReds from './zone/ZoneReds.vue';
import ZoneCores from './zone/ZoneCores.vue';
import ZoneCoreTimer from './zone/ZoneCoreTimer.vue';
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
}>>();

const store = useRoomStore();
const now = inject<Ref<number>>('globalNow', ref(Date.now()));

const timerValue = ref('');
const isEditingTimer = ref(false);
const activeEditingCore = ref<'powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | null>(null);
const timerComponentRef = ref<{ focus: () => void; blur: () => void } | null>(null);
const timerContainerRef = ref<HTMLElement | null>(null);

const isRedsOpen = ref(false);

onClickOutside(timerContainerRef, () => {
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

function toggleFeature(feature: 'powercoreBlue' | 'powercorePurple' | 'powercoreGreen' | 'crystalCreaturePresent' | 'chest' | 'resourceFibre' | 'resourceLeather' | 'resourceOre' | 'resourceStone' | 'resourceWood') {
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

function updateReds(val: number | undefined) {
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
  <div class="zone-node">
    <div 
      class="!bg-gray-800 border rounded overflow-hidden text-white text-xs px-2 py-3 text-center min-w-[160px] relative" 
      :class="[getBorderClass(props.data.type), props.data.isHome ? 'border-[3px] shadow-[0_0_10px_rgba(255,255,255,0.3)]' : '']"
    >
      <div class="absolute z-10" :class="props.data.isHome ? '-top-[3px] -left-[3px]' : '-top-[1px] -left-[1px]'">
        <TagTier :tier="props.data.tier" :type="props.data.type as ZoneType" class="!rounded-tr-none !rounded-bl-none py-3 w-6" />
      </div>

      <div class="font-bold text-sm flex items-center justify-center leading-tight">
        {{ props.data.zoneName || props.id }}
        <span v-if="props.data.isHome" class="ml-1">🏠</span>
      </div>
      <div class="flex items-center justify-center mt-1">
        <TagZone :type="props.data.type as ZoneType" :category="props.data.category" />
      </div>

      <template v-if="showFeatures">
        <!-- Power cores and Timer -->
        <div ref="timerContainerRef" class="mt-3">
          <ZoneCores 
            :features="props.data.features"
            :active-editing-core="activeEditingCore"
            :now="now"
            @toggle="toggleFeature"
          />

          <ZoneCoreTimer 
            ref="timerComponentRef"
            v-model="timerValue"
            :active-editing-core="activeEditingCore"
            :is-timer-too-long="isTimerTooLong"
            :is-timer-valid="isTimerValid"
            @save="saveTimer"
            @clear="clearTimer"
            @focus="onTimerFocus"
            @blur="onTimerBlur"
          />
        </div>

        <!-- Reds and other features -->
        <div class="flex items-center justify-center gap-1.5 mt-2">
          <ZoneReds 
            :reds="props.data.features?.reds"
            v-model:is-open="isRedsOpen"
            @update:reds="updateReds"
          />
          
          <ZoneFeatureToggle 
            type="crystalCreaturePresent"
            :active="!!props.data.features?.crystalCreaturePresent"
            title="Crystal Creature"
            @toggle="toggleFeature('crystalCreaturePresent')"
          />

          <ZoneFeatureToggle 
            type="chest"
            :active="!!props.data.features?.chest"
            title="Chests"
            @toggle="toggleFeature('chest')"
          />
        </div>

        <!-- Resources -->
        <div class="flex items-center justify-center gap-1.5 mt-2">
          <ZoneFeatureToggle 
            type="resourceFibre"
            :active="!!props.data.features?.resourceFibre"
            title="Fibre"
            @toggle="toggleFeature('resourceFibre')"
          />
          <ZoneFeatureToggle 
            type="resourceLeather"
            :active="!!props.data.features?.resourceLeather"
            title="Leather"
            @toggle="toggleFeature('resourceLeather')"
          />
          <ZoneFeatureToggle 
            type="resourceOre"
            :active="!!props.data.features?.resourceOre"
            title="Ore"
            @toggle="toggleFeature('resourceOre')"
          />
          <ZoneFeatureToggle 
            type="resourceStone"
            :active="!!props.data.features?.resourceStone"
            title="Stone"
            @toggle="toggleFeature('resourceStone')"
          />
          <ZoneFeatureToggle 
            type="resourceWood"
            :active="!!props.data.features?.resourceWood"
            title="Wood"
            @toggle="toggleFeature('resourceWood')"
          />
        </div>
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

</style>
