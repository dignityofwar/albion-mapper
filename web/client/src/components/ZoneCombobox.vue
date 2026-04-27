<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  ComboboxRoot,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxViewport,
  ComboboxItem,
  ComboboxItemIndicator,
} from 'reka-ui';
import { ZONES } from 'shared';
import type { Zone, ZoneType } from 'shared';
import { useRoomStore } from '../stores/useRoomStore.js';
import TagTier from './common/TagTier.vue';
import TagZone from './common/TagZone.vue';
import { TYPE_LABELS } from '../utils/zoneStyles';

const props = withDefaults(defineProps<{
  modelValue: string;
  placeholder?: string;
  excludedIds?: string[];
  showAlreadyAdded?: boolean;
  smartAlreadyAdded?: boolean;
  alreadyAddedPlacement?: 'top' | 'bottom';
  error?: boolean;
  disabled?: boolean;
  icon?: string;
}>(), {
  showAlreadyAdded: true,
  smartAlreadyAdded: false,
  alreadyAddedPlacement: 'bottom',
  disabled: false
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  tabSelect: [];
  select: [];
}>();

const store = useRoomStore();
const query = ref('');
const comboboxInput = ref<any>(null);
const isOpen = ref(false);
const highlightedId = ref<string | null>(null);

defineExpose({
  focus: () => {
    comboboxInput.value?.$el?.focus();
  },
  flash: () => {
    comboboxInput.value?.$el?.classList.add('flash-animation');
    setTimeout(() => {
      comboboxInput.value?.$el?.classList.remove('flash-animation');
    }, 1000);
  }
});

/** Full label including hideout distinction */
function zoneTypeLabel(zone: Zone): string {
  return TYPE_LABELS[zone.type];
}

// Zone IDs that appear in any current connection
const mappedZoneIds = computed<Set<string>>(() => {
  const ids = new Set<string>();
  for (const c of store.connections) {
    ids.add(c.fromZoneId);
    ids.add(c.toZoneId);
  }
  return ids;
});

const filteredZones = computed<Zone[]>(() => {
  const q = query.value.toLowerCase().trim();
  let zones = ZONES.filter((z) => {
    if (props.excludedIds && props.excludedIds.includes(z.id)) return false;
    if (props.showAlreadyAdded === false && mappedZoneIds.value.has(z.id)) return false;
    if (props.smartAlreadyAdded && !q && mappedZoneIds.value.has(z.id)) return false;
    
    if (!q) {
      return mappedZoneIds.value.has(z.id) || z.id === store.homeZoneId;
    }

    return (
      z.name.toLowerCase().includes(q) ||
      zoneTypeLabel(z).toLowerCase().includes(q) ||
      TYPE_LABELS[z.type].toLowerCase().includes(q) ||
      `t${z.tier}`.includes(q)
    );
  });

  if (props.smartAlreadyAdded) {
    zones.sort((a, b) => {
      const aHome = a.id === store.homeZoneId;
      const bHome = b.id === store.homeZoneId;
      if (aHome && !bHome) return -1;
      if (!aHome && bHome) return 1;

      if (q) {
        const aMapped = mappedZoneIds.value.has(a.id);
        const bMapped = mappedZoneIds.value.has(b.id);
        if (aMapped === bMapped) return 0;
        const direction = props.alreadyAddedPlacement === 'top' ? -1 : 1;
        return aMapped ? direction : -direction;
      }
      return 0;
    });
  }

  return zones.slice(0, 100);
});

/** Convert a stored zone ID back to the friendly display name for the input */
function displayValue(id: unknown): string {
  if (!id || typeof id !== 'string') return '';
  return ZONES.find((z) => z.id === id)?.name ?? id;
}

function onSelect(val: string | null) {
  if (val !== null) {
    emit('update:modelValue', val);
    emit('select');
    query.value = '';
  }
}

/** highlight payload: { ref: HTMLElement, value: string } | undefined */
function onHighlight(payload: unknown) {
  if (payload && typeof (payload as { value: string }).value === 'string') {
    highlightedId.value = (payload as { value: string }).value;
  } else {
    highlightedId.value = null;
  }
}

function onInputFocus() {
  query.value = '';
  isOpen.value = true;
}

/**
 * Capture Tab on the wrapper so we intercept before reka-ui's own keydown
 * handlers (which only cover Up/Down). When a dropdown item is highlighted we
 * accept it and move focus to the next field.
 */
function onWrapperKeydown(e: KeyboardEvent) {
  if (e.key !== 'Tab' && e.key !== 'Enter') return;
  const id = highlightedId.value;
  if (!id) return;
  e.preventDefault();
  emit('update:modelValue', id);
  query.value = '';
  highlightedId.value = null;
  if (e.key === 'Tab') {
    emit('tabSelect');
  } else {
    emit('select');
  }
}
</script>

<template>
  <!-- capture Tab on the wrapper before reka-ui's internal listeners fire -->
  <div class="relative" @keydown.capture="onWrapperKeydown">
    <ComboboxRoot
      :model-value="modelValue"
      v-model:open="isOpen"
      @update:model-value="onSelect"
      @highlight="onHighlight"
      :ignore-filter="true"
      :disabled="disabled"
      data-testid="zone-combobox"
    >
      <div 
        class="flex items-center border rounded bg-gray-800 text-white px-3 py-2.5 md:py-2" 
        :class="[
          error ? 'border-red-500' : 'border-gray-600',
          disabled ? 'cursor-not-allowed text-gray-400' : ''
        ]"
      >
        <span v-if="icon" class="mr-2 text-sm leading-none shrink-0">{{ icon }}</span>
        <ComboboxInput
          ref="comboboxInput"
          v-model="query"
          :display-value="displayValue"
          :placeholder="placeholder ?? 'Search zones…'"
          class="flex-1 bg-transparent py-0 outline-none text-sm leading-none min-w-0"
          :class="disabled ? 'cursor-not-allowed opacity-75' : ''"
          data-testid="zone-combobox-input"
          @focus="onInputFocus"
        />
        <ComboboxTrigger 
          class="pl-3 py-0 text-gray-400 text-sm leading-none"
          :class="disabled ? 'cursor-not-allowed' : 'hover:text-white'"
          :disabled="disabled"
        >
          ▾
        </ComboboxTrigger>
      </div>

      <ComboboxContent
        class="absolute z-50 mt-1 w-full bg-gray-900 border border-gray-600 rounded shadow-lg max-h-64 overflow-hidden"
      >
        <ComboboxViewport class="overflow-y-auto max-h-64">
          <div v-if="filteredZones.length === 0" class="px-3 text-sm text-gray-400">
            {{ query ? 'No zones found' : 'Type to search all zones…' }}
          </div>
          <ComboboxItem
            v-for="zone in filteredZones"
            :key="zone.id"
            :value="zone.id"
            class="flex items-center gap-2 px-3 text-sm text-white cursor-pointer hover:bg-gray-700 data-[highlighted]:bg-gray-700"
          >
            <span class="truncate flex-1">{{ zone.name }}</span>
            <span v-if="mappedZoneIds.has(zone.id)" class="shrink-0 text-green-400">✓</span>
            <span v-if="zone.id === store.homeZoneId" class="shrink-0 text-yellow-400" title="Room home zone">🏠</span>
            <TagTier :tier="zone.tier" :type="zone.type" />
            <TagZone :type="zone.type" />
            <ComboboxItemIndicator class="shrink-0 text-green-400">✓</ComboboxItemIndicator>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxRoot>
  </div>
</template>
