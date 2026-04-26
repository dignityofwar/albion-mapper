<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { ZONE_BY_ID } from 'shared';
import type { ZoneType } from 'shared';

const props = defineProps<{
  id: string;
  data: { isHome: boolean };
}>();

const zone = computed(() => ZONE_BY_ID.get(props.id));

const TYPE_COLORS: Record<ZoneType, string> = {
  royalBlue: 'border-blue-500 bg-blue-950',
  royalYellow: 'border-yellow-400 bg-yellow-950',
  royalRed: 'border-red-500 bg-red-950',
  outlands: 'border-gray-600 bg-gray-900',
  roads: 'border-gray-400 bg-gray-800',
  other: 'border-gray-500 bg-gray-800',
};

const badgeColors: Record<ZoneType, string> = {
  royalBlue: 'bg-blue-500',
  royalYellow: 'bg-yellow-400 text-black',
  royalRed: 'bg-red-500',
  outlands: 'bg-gray-700',
  roads: 'bg-gray-500',
  other: 'bg-gray-400 text-black',
};

const nodeClass = computed(() => {
  const z = zone.value;
  if (!z) return 'border border-gray-500 bg-gray-800';
  const base = TYPE_COLORS[z.type];
  const size = props.data.isHome ? 'w-36 h-36 flex flex-col items-center justify-center' : 'w-28 h-28 flex flex-col items-center justify-center';
  const border = props.data.isHome ? 'border-2' : 'border';
  const isHome = props.data.isHome ? 'ring-2 ring-white ring-offset-1 ring-offset-black' : '';
  const roadsHome = z.isRoadsHome ? 'border-dashed' : '';
  return `${base} ${border} ${size} ${isHome} ${roadsHome} rounded-lg text-white text-center cursor-pointer select-none`;
});
</script>

<template>
  <Handle type="target" :position="Position.Top" />

  <div :class="nodeClass">
    <template v-if="zone">
      <div class="flex items-center justify-center gap-1 mb-0.5">
        <span
          :class="['rounded px-1 py-0.5 text-xs font-bold', badgeColors[zone.type]]"
        >T{{ zone.tier }}</span>
        <span v-if="zone.isRoadsHome" class="text-yellow-400 text-xs" title="Hideout capable">🏠</span>
      </div>
      <div :class="['font-medium leading-tight break-words w-full text-center px-1', props.data.isHome ? 'text-base' : 'text-sm']">
        {{ zone.name }}
      </div>
    </template>
    <template v-else>
      <div class="text-xs text-gray-400">{{ id }}</div>
    </template>
  </div>

  <Handle type="source" :position="Position.Bottom" />
</template>
