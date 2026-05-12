<script setup lang="ts">
import { TooltipRoot, TooltipTrigger, TooltipContent, TooltipPortal } from 'reka-ui';

defineProps<{
  hasReds?: boolean;
}>();

defineEmits<{
  ping: [];
}>();
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger asChild>
      <button
        :class="['w-9 h-9 flex items-center justify-center zone-button round-button ping-button shadow-lg text-lg pointer-events-auto', hasReds ? 'zone-button-reds' : '']"
        @click.stop="$emit('ping')"
      >📍</button>
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent class="bg-black text-white text-xs px-2 py-1 rounded shadow-lg z-[10000]">
        Ping this zone
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
