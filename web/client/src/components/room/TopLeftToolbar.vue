<script setup lang="ts">
import RoomResourcesToolbar from '../flow/zone/RoomResourcesToolbar.vue';
import { Z_INDEX } from '@/constants/Layers';

defineProps<{
  fibre: any[];
  leather: any[];
  ore: any[];
  stone: any[];
  wood: any[];
}>();

const emit = defineEmits<{
  (e: 'select', nodeId: string): void;
}>();
</script>

<template>
  <!-- Resource Summary Tray + refresh button (Desktop only) -->
  <div class="absolute top-20 left-4 hidden md:flex flex-col gap-2 pointer-events-none" :class="Z_INDEX.TRAY">
    <RoomResourcesToolbar
      :fibre="fibre"
      :leather="leather"
      :ore="ore"
      :stone="stone"
      :wood="wood"
      @select="emit('select', $event)"
    />
  </div>
</template>
