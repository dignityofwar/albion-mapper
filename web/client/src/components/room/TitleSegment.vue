<script setup lang="ts">
import RoomSettings from '../RoomSettings.vue';
import { Z_INDEX } from '@/constants/Layers';

defineProps<{
  roomTitle?: string;
}>();

const emit = defineEmits<{
  (e: 'logout'): void;
  (e: 'fitView'): void;
}>();
</script>

<template>
  <!-- Desktop: logo + settings cog + room title, below status bar -->
  <div :class="['absolute top-2 left-6 hidden md:flex items-center gap-3', Z_INDEX.OVERLAY]">
    <img src="/images/favicon/android-icon-192x192.png" class="w-8 h-8 inline-block cursor-pointer" alt="Site Logo" @click="emit('logout')" />
    <RoomSettings />
    <h1 v-if="roomTitle" class="text-xl font-bold text-gray-200 truncate leading-none px-4 py-2 rounded-full frosted-pill" :title="roomTitle" data-testid="room-title">
      {{ roomTitle }}
    </h1>
  </div>

  <!-- Mobile: logo + settings (left column) -->
  <div :class="['md:hidden absolute top-2 left-2 flex flex-col gap-2', Z_INDEX.OVERLAY]">
    <img src="/images/favicon/android-icon-192x192.png" class="w-8 h-8 ml-2 cursor-pointer" alt="Site Logo" @click="emit('logout')" />
    <RoomSettings :tray="true" />
  </div>

  <!-- Mobile: room title (centred on portrait, left-aligned on landscape) -->
  <div :class="['md:hidden absolute top-2 title-mobile-wrap', Z_INDEX.OVERLAY]">
    <h1 v-if="roomTitle" class="text-lg font-bold text-gray-200 truncate leading-none px-4 py-2 rounded-full frosted-pill" :title="roomTitle" data-testid="room-title-mobile">
      {{ roomTitle }}
    </h1>
  </div>
</template>

<style scoped>
/* Portrait mobile: centred */
.title-mobile-wrap {
  left: 50%;
  transform: translateX(-50%);
  justify-content: center;
}
/* Landscape mobile: left-aligned, next to logo/settings */
@media (max-width: 767px) and (max-height: 500px) {
  .title-mobile-wrap {
    left: 5rem;
    transform: none;
    padding-left: 0;
    padding-right: 0;
    justify-content: flex-start;
  }
}
</style>
