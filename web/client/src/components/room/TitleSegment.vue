<script setup lang="ts">
import RoomSettings from '../RoomSettings.vue';

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
  <div class="absolute top-8 left-4 hidden md:flex items-center gap-3 z-[50]">
    <img src="/images/favicon/android-icon-192x192.png" class="w-8 h-8 inline-block cursor-pointer" alt="Site Logo" @click="emit('logout')" />
    <RoomSettings />
    <h1 v-if="roomTitle" class="text-xl font-bold text-gray-200 truncate leading-none px-4 py-1 rounded-full frosted-pill" :title="roomTitle" data-testid="room-title">
      {{ roomTitle }}
    </h1>
  </div>

  <!-- Mobile: logo + settings (left column) -->
  <div class="md:hidden absolute top-10 left-4 flex flex-col gap-2 z-[50]">
    <img src="/images/favicon/android-icon-192x192.png" class="w-8 h-8 ml-2 cursor-pointer" alt="Site Logo" @click="emit('logout')" />
    <RoomSettings :tray="true" />
  </div>

  <!-- Mobile: room title (centred) -->
  <div class="md:hidden absolute top-8 left-1/2 -translate-x-1/2 flex justify-center px-16 z-[50]">
    <h1 v-if="roomTitle" class="text-lg font-bold text-gray-200 truncate leading-none px-4 py-2 rounded-full frosted-pill" :title="roomTitle" data-testid="room-title-mobile">
      {{ roomTitle }}
    </h1>
  </div>
</template>
