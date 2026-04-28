<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import type { ZoneType, NodeFeatures } from 'shared';
import TagTier from '../common/TagTier.vue';
import TagZone from '../common/TagZone.vue';
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
const timerInputRef = ref<HTMLInputElement | null>(null);
const timerContainerRef = ref<HTMLElement | null>(null);

const redsInputRef = ref<HTMLInputElement | null>(null);
const isRedsOpen = ref(false);
const redsValue = ref('');

watch(() => props.data.features?.reds, (newVal) => {
  if (newVal !== undefined && newVal !== null) {
    redsValue.value = String(newVal);
  } else {
    redsValue.value = '';
  }
}, { immediate: true });

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

function isCoreActive(core: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple'): boolean {
  if (!props.data.features?.[core]) return false;
  const timerKey = core === 'powercoreGreen' ? 'powercoreTimerGreen' : core === 'powercoreBlue' ? 'powercoreTimerBlue' : 'powercoreTimerPurple';
  const expiresAt = props.data.features?.[timerKey as keyof NodeFeatures] as number | undefined;
  if (!expiresAt) return true;
  return expiresAt > now.value;
}

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
        timerInputRef.value?.blur();
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

function saveReds() {
  const features = { ...(props.data.features || {}) };
  if (redsValue.value === '' || redsValue.value === null) {
    delete features.reds;
  } else {
    const val = parseInt(String(redsValue.value), 10);
    if (isNaN(val)) {
      delete features.reds;
    } else {
      features.reds = val;
    }
  }
  store.updateNodeFeatures(props.id, features);
}

function toggleReds() {
  if (props.data.features?.reds !== undefined) {
    redsValue.value = '';
    saveReds();
    isRedsOpen.value = false;
  } else {
    isRedsOpen.value = !isRedsOpen.value;
    if (isRedsOpen.value) {
      nextTick(() => {
        redsInputRef.value?.focus();
      });
    }
  }
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
    <Handle type="source" :position="Position.Top" id="top" />
    <Handle type="source" :position="Position.Right" id="right" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="source" :position="Position.Left" id="left" />

    <div class="!bg-gray-800 border rounded overflow-hidden text-white text-xs px-2 py-3 text-center min-w-[160px] relative" :class="getBorderClass(props.data.type)">
      <div class="absolute -top-[1px] -left-[1px] z-10">
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
          <!-- Power cores -->
          <div class="flex items-center justify-center gap-1.5">
            <button 
              @click.stop="toggleFeature('powercoreGreen')" 
              :class="[
                isCoreActive('powercoreGreen') ? 'bg-green-600' : 'bg-gray-700',
                activeEditingCore === 'powercoreGreen' ? 'ring-1 ring-white' : ''
              ]" 
              class="text-white rounded p-1 leading-none transition-colors hover:bg-green-500 flex items-center" 
              title="Green Core"
            >
              <img src="/images/core-green.png" class="w-6 h-6 p-[2px]" />
              <span v-if="isCoreActive('powercoreGreen') && props.data.features?.powercoreTimerGreen" class="ml-1 text-[10px] font-mono">
                {{ formatTimer(props.data.features.powercoreTimerGreen) }}
              </span>
            </button>
            <button 
              @click.stop="toggleFeature('powercoreBlue')" 
              :class="[
                isCoreActive('powercoreBlue') ? 'bg-blue-600' : 'bg-gray-700',
                activeEditingCore === 'powercoreBlue' ? 'ring-1 ring-white' : ''
              ]" 
              class="text-white rounded p-1 leading-none transition-colors hover:bg-blue-500 flex items-center" 
              title="Blue Core"
            >
              <img src="/images/core-blue.png" class="w-6 h-6 p-[2px]" />
              <span v-if="isCoreActive('powercoreBlue') && props.data.features?.powercoreTimerBlue" class="ml-1 text-[10px] font-mono">
                {{ formatTimer(props.data.features.powercoreTimerBlue) }}
              </span>
            </button>
            <button 
              @click.stop="toggleFeature('powercorePurple')" 
              :class="[
                isCoreActive('powercorePurple') ? 'bg-purple-600' : 'bg-gray-700',
                activeEditingCore === 'powercorePurple' ? 'ring-1 ring-white' : ''
              ]" 
              class="text-white rounded p-1 leading-none transition-colors hover:bg-purple-500 flex items-center" 
              title="Purple Core"
            >
              <img src="/images/core-purple.png" class="w-6 h-6 p-[2px]" />
              <span v-if="isCoreActive('powercorePurple') && props.data.features?.powercoreTimerPurple" class="ml-1 text-[10px] font-mono">
                {{ formatTimer(props.data.features.powercoreTimerPurple) }}
              </span>
            </button>
          </div>

          <!-- Timer -->
          <Transition name="slide">
            <div v-if="activeEditingCore" class="mt-1.5 flex justify-center items-center gap-1 overflow-hidden">
              <input 
                ref="timerInputRef"
                type="text" 
                v-model="timerValue"
                @focus="onTimerFocus"
                @blur="onTimerBlur"
                @keydown.enter="saveTimer"
                :placeholder="activeEditingCore ? 'MM:SS' : 'Select core'"
                :disabled="!activeEditingCore"
                :class="[
                  'nodrag bg-gray-900 text-white text-[11px] w-14 text-center border rounded py-0.5 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
                  isTimerTooLong ? 'border-red-500 text-red-500' : 'border-gray-600 focus:border-blue-400'
                ]"
                @click.stop
              />
              <button 
                @click.stop="saveTimer"
                :disabled="!activeEditingCore || (!isTimerValid && timerValue !== '') || isTimerTooLong"
                class="nodrag bg-gray-700 hover:bg-gray-600 text-white rounded px-1.5 py-0.5 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Save Timer"
              >
                ↵
              </button>
              <button 
                @click.stop="clearTimer"
                :disabled="!activeEditingCore"
                class="nodrag bg-gray-700 hover:bg-gray-600 text-white rounded px-1.5 py-0.5 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Clear Timer"
              >
                ✕
              </button>
            </div>
          </Transition>
        </div>

        <!-- Reds and other features -->
        <div class="flex items-center justify-center gap-1.5 mt-2">
          <button 
            @click.stop="toggleReds" 
            :class="[
              (props.data.features?.reds !== undefined || isRedsOpen) ? 'bg-red-700 border-red-400' : 'bg-gray-700 border-transparent',
              'text-white rounded p-1 border leading-none transition-all hover:opacity-80 flex items-center justify-center overflow-hidden gap-0'
            ]" 
            title="Reds"
          >
            <img src="/images/reds.png" class="w-6 h-6 p-[2px]" alt="Reds" />
            <Transition name="slide-right">
              <input 
                v-if="isRedsOpen || props.data.features?.reds !== undefined"
                ref="redsInputRef"
                type="number"
                v-model="redsValue"
                @input="saveReds"
                @click.stop
                class="nodrag bg-transparent text-white text-[14px] w-4 text-center border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none leading-none p-0"
                placeholder="0"
              />
            </Transition>
          </button>
          
          <button @click.stop="toggleFeature('crystalCreaturePresent')" :class="props.data.features?.crystalCreaturePresent ? 'bg-gray-600 border-white' : 'bg-gray-700 border-transparent'" class="text-white rounded p-1 border leading-none transition-colors flex items-center justify-center hover:opacity-80" title="Crystal Creature">
            <img src="/images/crystal.png" class="w-6 h-6 p-[2px]" alt="Crystal" />
          </button>

          <button @click.stop="toggleFeature('chest')" :class="props.data.features?.chest ? 'bg-gray-600 border-white' : 'bg-gray-700 border-transparent'" class="text-white rounded p-1 border leading-none transition-colors hover:opacity-80 flex items-center justify-center" title="Chests">
            <img src="/images/chest.png" class="w-6 h-6 p-[2px]" alt="Chest" />
          </button>
        </div>

        <!-- Resources -->
        <div class="flex items-center justify-center gap-1.5 mt-2">
          <button @click.stop="toggleFeature('resourceFibre')" :class="props.data.features?.resourceFibre ? 'bg-gray-600 border-white' : 'bg-gray-700 border-transparent'" class="text-white rounded p-1 border leading-none transition-colors hover:opacity-80 flex items-center justify-center" title="Fibre">
            <img src="/images/resource-fibre.png" class="w-6 h-6 p-[2px]" alt="Fibre" />
          </button>
          <button @click.stop="toggleFeature('resourceLeather')" :class="props.data.features?.resourceLeather ? 'bg-gray-600 border-white' : 'bg-gray-700 border-transparent'" class="text-white rounded p-1 border leading-none transition-colors hover:opacity-80 flex items-center justify-center" title="Leather">
            <img src="/images/resource-leather.png" class="w-6 h-6 p-[2px]" alt="Leather" />
          </button>
          <button @click.stop="toggleFeature('resourceOre')" :class="props.data.features?.resourceOre ? 'bg-gray-600 border-white' : 'bg-gray-700 border-transparent'" class="text-white rounded p-1 border leading-none transition-colors hover:opacity-80 flex items-center justify-center" title="Ore">
            <img src="/images/resource-ore.png" class="w-6 h-6 p-[2px]" alt="Ore" />
          </button>
          <button @click.stop="toggleFeature('resourceStone')" :class="props.data.features?.resourceStone ? 'bg-gray-600 border-white' : 'bg-gray-700 border-transparent'" class="text-white rounded p-1 border leading-none transition-colors hover:opacity-80 flex items-center justify-center" title="Stone">
            <img src="/images/resource-stone.png" class="w-6 h-6 p-[2px]" alt="Stone" />
          </button>
          <button @click.stop="toggleFeature('resourceWood')" :class="props.data.features?.resourceWood ? 'bg-gray-600 border-white' : 'bg-gray-700 border-transparent'" class="text-white rounded p-1 border leading-none transition-colors hover:opacity-80 flex items-center justify-center" title="Wood">
            <img src="/images/resource-wood.png" class="w-6 h-6 p-[2px]" alt="Wood" />
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
:deep(.vue-flow__handle) {
  width: 8px;
  height: 8px;
  background: #aaa;
}

@media (pointer: coarse) {
  :deep(.vue-flow__handle) {
    width: 16px;
    height: 16px;
  }
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease-in-out;
  max-height: 40px;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
  margin-top: 0 !important;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s ease-in-out;
  max-width: 50px;
  overflow: hidden;
}

.slide-right-enter-from,
.slide-right-leave-to {
  max-width: 0;
  opacity: 0;
}
</style>
