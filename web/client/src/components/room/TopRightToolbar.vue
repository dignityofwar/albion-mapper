<script setup lang="ts">
import RoomMapFeaturesToolbar from '../flow/zone/RoomMapFeaturesToolbar.vue';
import { Z_INDEX } from '@/constants/Layers';

defineProps<{
  cores: any[];
  crystals: any[];
  dungeons: any[];
  chests: any[];
}>();

const emit = defineEmits<{
  (e: 'select', nodeId: string): void;
}>();
</script>

<template>
  <!-- Map Features Summary Toolbar (Desktop only) -->
  <div class="toolbar-wrap absolute top-20 md:top-8 right-4 pointer-events-none" :class="Z_INDEX.TRAY">
    <RoomMapFeaturesToolbar
      :cores="cores"
      :crystals="crystals"
      :dungeons="dungeons"
      :chests="chests"
      @select="emit('select', $event)"
    />
  </div>
</template>

<style scoped>
/* Hidden on portrait mobile, visible on landscape (phone or desktop) */
.toolbar-wrap {
  display: none;
}
@media (max-height: 500px) {
  .toolbar-wrap {
    display: flex;
  }
}
@media (min-width: 768px) {
  .toolbar-wrap {
    display: flex;
  }
}
</style>
