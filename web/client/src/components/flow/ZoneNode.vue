<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';

const props = defineProps<NodeProps<{ isHome: boolean; tier: string; zoneName: string; isRoad: boolean }>>();
</script>

<template>
  <Handle type="source" :position="Position.Top" id="top" />
  <Handle type="source" :position="Position.Right" id="right" />
  <Handle type="source" :position="Position.Bottom" id="bottom" />
  <Handle type="source" :position="Position.Left" id="left" />

  <div class="border border-gray-500 rounded text-white text-xs px-2 py-1 text-center">
    <div class="font-bold">{{ props.data.zoneName || props.id }}</div>
    <div class="text-gray-400 text-[10px] uppercase">{{ props.data.tier }}</div>
    <div v-if="props.data.isRoad" class="text-green-500 text-[10px] uppercase">Road Zone</div>
    <span v-if="props.data.isHome"> 🏠</span>
  </div>
</template>
