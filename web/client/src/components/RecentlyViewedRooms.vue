<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useRoomStore } from '@/stores/useRoomStore';

const router = useRouter();
const store = useRoomStore();
</script>

<template>
  <div v-if="store.recentlyViewedRooms.length > 0" class="w-full max-w-md bg-gray-900/50 border border-gray-800 rounded-xl p-6 mt-6">
    <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Recently Viewed</h2>
    <div class="flex flex-col gap-2">
      <div
        v-for="room in store.recentlyViewedRooms"
        :key="room.id"
        class="group flex items-center justify-between bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 rounded-lg p-3 transition-colors cursor-pointer"
        @click="router.push(`/rooms/${room.vanityUrl || room.id}`)"
      >
        <div class="flex flex-col">
          <span class="font-medium text-gray-200">{{ room.title }}</span>
          <span class="text-xs text-gray-500">{{ room.vanityUrl || room.id }}</span>
        </div>
        <button
          class="p-1 text-gray-500 hover:text-red-400 opacity-60 hover:opacity-100 transition-all"
          @click.stop="store.removeFromRecentRooms(room.id)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
