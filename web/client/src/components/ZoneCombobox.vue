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

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
  excludeId?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  tabSelect: [];
}>();

const store = useRoomStore();
const query = ref('');
const isOpen = ref(false);
const highlightedId = ref<string | null>(null);

const TYPE_LABELS: Record<ZoneType, string> = {
  royalBlue: 'Royal Blue',
  royalYellow: 'Royal Yellow',
  royalRed: 'Royal Red',
  outlands: 'Outlands',
  roads: 'Roads',
  other: 'Other',
};

/** Full label including hideout distinction */
function zoneTypeLabel(zone: Zone): string {
  if (zone.type === 'roads' && zone.isRoadsHome) return 'Roads (Hideout)';
  return TYPE_LABELS[zone.type];
}

/** Zone IDs that appear in any current connection */
const mappedZoneIds = computed<Set<string>>(() => {
  const ids = new Set<string>();
  for (const c of store.connections) {
    ids.add(c.fromZoneId);
    ids.add(c.toZoneId);
  }
  return ids;
});

const TYPE_STYLES: Record<ZoneType, string> = {
  royalBlue:   'background-color:rgb(5,86,190);color:#fff',
  royalYellow: 'background-color:rgb(207,165,0);color:#fff',
  royalRed:    'background-color:rgb(184,0,0);color:#fff',
  outlands:    'background-color:rgb(0,0,0);color:#fff;border:1px solid #fff',
  roads:       'background-color:rgb(107,114,128);color:#fff',
  other:       'background-color:rgb(128,128,128);color:#fff',
};

const filteredZones = computed<Zone[]>(() => {
  const q = query.value.toLowerCase().trim();
  if (!q) {
    // No query: show zones already present in current connections + always include the home zone
    return ZONES.filter((z) => {
      if (props.excludeId && z.id === props.excludeId) return false;
      return mappedZoneIds.value.has(z.id) || z.id === store.homeZoneId;
    });
  }
  return ZONES.filter((z) => {
    if (props.excludeId && z.id === props.excludeId) return false;
    return (
      z.name.toLowerCase().includes(q) ||
      zoneTypeLabel(z).toLowerCase().includes(q) ||
      TYPE_LABELS[z.type].toLowerCase().includes(q) ||
      `t${z.tier}`.includes(q)
    );
  }).slice(0, 100);
});

/** Convert a stored zone ID back to the friendly display name for the input */
function displayValue(id: unknown): string {
  if (!id || typeof id !== 'string') return '';
  return ZONES.find((z) => z.id === id)?.name ?? id;
}

function onSelect(val: string | null) {
  if (val !== null) {
    emit('update:modelValue', val);
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
  if (e.key !== 'Tab') return;
  const id = highlightedId.value;
  if (!id) return;
  e.preventDefault();
  emit('update:modelValue', id);
  query.value = '';
  highlightedId.value = null;
  emit('tabSelect');
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
      data-testid="zone-combobox"
    >
      <div class="flex items-center border border-gray-600 rounded bg-gray-800 text-white">
        <ComboboxInput
          v-model="query"
          :display-value="displayValue"
          :placeholder="placeholder ?? 'Search zones…'"
          class="flex-1 bg-transparent px-3 py-2 outline-none text-sm min-w-0"
          data-testid="zone-combobox-input"
          @focus="onInputFocus"
        />
        <ComboboxTrigger class="px-2 py-2 text-gray-400 hover:text-white">▾</ComboboxTrigger>
      </div>

      <ComboboxContent
        class="absolute z-50 mt-1 w-full bg-gray-900 border border-gray-600 rounded shadow-lg max-h-64 overflow-hidden"
      >
        <ComboboxViewport class="overflow-y-auto max-h-64">
          <div v-if="filteredZones.length === 0" class="px-3 py-2 text-sm text-gray-400">
            {{ query ? 'No zones found' : 'Type to search all zones…' }}
          </div>
          <ComboboxItem
            v-for="zone in filteredZones"
            :key="zone.id"
            :value="zone.id"
            class="flex items-center gap-2 px-3 py-2 text-sm text-white cursor-pointer hover:bg-gray-700 data-[highlighted]:bg-gray-700"
          >
            <span class="truncate flex-1">{{ zone.name }}</span>
            <span v-if="zone.id === store.homeZoneId" class="shrink-0 text-yellow-400" title="Room home zone">🏠</span>
            <span
              :style="TYPE_STYLES[zone.type]"
              class="rounded px-1 py-0.5 text-xs font-semibold shrink-0"
            >
              {{ zoneTypeLabel(zone) }}
            </span>
            <span class="text-gray-400 text-xs shrink-0">T{{ zone.tier }}</span>
            <ComboboxItemIndicator class="shrink-0 text-green-400">✓</ComboboxItemIndicator>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxRoot>
  </div>
</template>
