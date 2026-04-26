<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
import type { NodeProps } from '@vue-flow/core';

const props = defineProps<NodeProps<{ isHome: boolean }>>();
</script>

<template>
  <!-- Single centered target handle; ConnectionMode.Loose lets it act as source too -->
  <Handle type="target" :position="Position.Left" />

  <div class="border border-gray-500 rounded text-white text-xs px-2 py-1 text-center">
    {{ props.id }}
    <span v-if="props.data.isHome"> 🏠</span>
  </div>
</template>
