<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';
import type { ZoneType } from 'shared';
import TagTier from '../common/TagTier.vue';
import TagZone from '../common/TagZone.vue';

const props = defineProps<NodeProps<{ 
  isHome: boolean; 
  tier: number; 
  zoneName: string; 
  type: string; 
}>>();

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
    <Handle type="source" :position="Position.Top" id="top" />
    <Handle type="source" :position="Position.Right" id="right" />
    <Handle type="source" :position="Position.Bottom" id="bottom" />
    <Handle type="source" :position="Position.Left" id="left" />

    <div class="!bg-gray-800 border rounded text-white text-xs px-2 py-1 text-center min-w-[120px]" :class="getBorderClass(props.data.type)">
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
