<script setup lang="ts">
import { ref, computed } from 'vue';
import { ZONE_BY_ID } from 'shared';
import TagTier from './common/TagTier.vue';
import TagZone from './common/TagZone.vue';
import { TYPE_LABELS, getZoneTypeDisplay } from '../utils/zoneStyles';
import type { ZoneType } from 'shared';

const props = defineProps<{
  nodes: { id: string; data: { zoneName: string; tier: number; type: string; category?: string; mapShape?: string; proximityTo?: string; isGhost?: boolean } }[];
}>();

const emit = defineEmits<{
  select: [nodeId: string];
}>();

const query = ref('');
const isOpen = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);

function zoneTypeLabel(type: string, mapShape?: string): string {
  return getZoneTypeDisplay(type as ZoneType, mapShape).label;
}

const filteredNodes = computed(() => {
  const q = query.value.toLowerCase().trim();
  return props.nodes.filter(node => {
    if (node.data.isGhost) return false;
    const zone = ZONE_BY_ID.get(node.id);
    const name = node.data.zoneName.toLowerCase();
    const type = node.data.type;
    const typeLabel = zoneTypeLabel(type, node.data.mapShape).toLowerCase();
    const typeBase = (TYPE_LABELS[type as ZoneType] ?? '').toLowerCase();
    const tier = `t${node.data.tier}`;
    const category = (node.data.category ?? '').toLowerCase();
    const proximityTo = (node.data.proximityTo ?? zone?.proximityTo ?? '').toLowerCase();

    if (!q) return true;
    return (
      name.includes(q) ||
      typeLabel.includes(q) ||
      typeBase.includes(q) ||
      tier.includes(q) ||
      category.includes(q) ||
      proximityTo.includes(q)
    );
  });
});

function onFocus() {
  isOpen.value = true;
}

function onBlur() {
  // Delay to allow click on item
  setTimeout(() => {
    isOpen.value = false;
  }, 150);
}

function selectNode(nodeId: string) {
  emit('select', nodeId);
  query.value = '';
  isOpen.value = false;
  inputRef.value?.blur();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    query.value = '';
    isOpen.value = false;
    inputRef.value?.blur();
  }
}
</script>

<template>
  <div class="relative w-64 md:w-80" ref="containerRef">
    <div class="flex items-center border border-gray-700/50 rounded frosted-background text-white px-3 py-1.5 transition-colors focus-within:border-white" :class="{ '!bg-gray-800/80': isOpen }">
      <span class="mr-2 text-gray-400 text-sm leading-none shrink-0">🔍</span>
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        placeholder="Search active zones…"
        class="flex-1 bg-transparent outline-none text-sm leading-none min-w-0 placeholder-gray-500"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <button
        v-if="query"
        class="ml-1 text-gray-400 hover:text-white text-xs leading-none shrink-0"
        @mousedown.prevent="query = ''"
      >&times;</button>
    </div>

    <div
      v-if="isOpen"
      class="absolute z-[200] mt-1 w-full frosted-background border border-gray-700/50 rounded shadow-lg max-h-64 overflow-y-auto !bg-gray-800/80"
    >
      <div v-if="filteredNodes.length === 0" class="px-3 py-2 text-sm text-gray-400">
        No active zones found
      </div>
      <button
        v-for="node in filteredNodes"
        :key="node.id"
        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-white cursor-pointer hover:bg-gray-700 text-left"
        @mousedown.prevent="selectNode(node.id)"
      >
        <TagTier :tier="node.data.tier" :type="node.data.type as ZoneType" />
        <span class="truncate flex-1">{{ node.data.zoneName }}</span>
        <TagZone
          :type="node.data.type as ZoneType"
          :category="node.data.category"
          :map-shape="node.data.mapShape"
          :zone-name="node.data.zoneName"
          :proximity-to="node.data.proximityTo"
        />
      </button>
    </div>
  </div>
</template>
