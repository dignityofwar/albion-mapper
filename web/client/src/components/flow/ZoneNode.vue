<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import type { ZoneType, NodeFeatures } from 'shared';
import TagTier from '../common/TagTier.vue';
import TagZone from '../common/TagZone.vue';
import { useRoomStore } from '../../stores/useRoomStore';
import { NodeToolbar } from '@vue-flow/node-toolbar';
import { computed } from 'vue';

const props = defineProps<NodeProps<{ 
  isHome: boolean; 
  tier: number; 
  zoneName: string; 
  type: string; 
  features?: NodeFeatures;
}>>();

const store = useRoomStore();

const hasActiveFeatures = computed(() => {
  const f = props.data.features;
  return !!(f?.enemySighted || f?.powercoreBlue || f?.powercorePurple || f?.powercoreGreen);
});

function toggleFeature(feature: keyof NodeFeatures) {
  const currentFeatures = props.data.features || {};
  const features = { ...currentFeatures, [feature]: !currentFeatures[feature] };
  store.updateNodeFeatures(props.id, features);
}

function getBorderClass(type: string): string {
  switch (type) {
    case 'royalBlue': return 'border-blue-500';
    case 'royalYellow': return 'border-yellow-500';
    case 'royalRed': return 'border-red-500';
    case 'outlands': return 'border-black';
    case 'roads': return 'border-gray-500';
    default: return 'border-gray-500';
  }
}
</script>

<template>
  <div class="zone-node">
    <NodeToolbar :is-visible="props.selected || hasActiveFeatures" :position="Position.Top" class="flex gap-1">
      <button @click="toggleFeature('enemySighted')" :class="props.data.features?.enemySighted ? 'bg-red-500' : 'bg-gray-700'" class="text-white rounded p-2">👁️</button>
      <button @click="toggleFeature('powercoreGreen')" :class="props.data.features?.powercoreGreen ? 'bg-green-500' : 'bg-gray-700'" class="text-white rounded p-2">🟢</button>
      <button @click="toggleFeature('powercoreBlue')" :class="props.data.features?.powercoreBlue ? 'bg-blue-500' : 'bg-gray-700'" class="text-white rounded p-2">🔵</button>
      <button @click="toggleFeature('powercorePurple')" :class="props.data.features?.powercorePurple ? 'bg-purple-500' : 'bg-gray-700'" class="text-white rounded p-2">🟣</button>
    </NodeToolbar>

    <Handle type="source" :position="Position.Top" id="top" />
    <Handle type="source" :position="Position.Right" id="right" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="source" :position="Position.Left" id="left" />

    <div class="!bg-gray-800 border rounded text-white text-xs px-4 py-3 text-center min-w-[120px]" :class="getBorderClass(props.data.type)">
      <div class="font-bold flex items-center justify-center">
        {{ props.data.zoneName || props.id }}
        <span v-if="props.data.isHome" class="ml-1">🏠</span>
      </div>
      <div class="flex items-center justify-center gap-1 mt-1">
        <TagTier :tier="props.data.tier" :type="props.data.type as ZoneType" />
        <TagZone :type="props.data.type as ZoneType" />
      </div>
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
</style>
