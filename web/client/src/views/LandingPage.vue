<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useRoomStore } from '../stores/useRoomStore';
import CreateRoomModal from '../components/CreateRoomModal.vue';
import JoinRoomModal from '../components/JoinRoomModal.vue';
import RecentlyViewedRooms from '../components/RecentlyViewedRooms.vue';

const router = useRouter();
const route = useRoute();
const store = useRoomStore();

const showCreate = ref(false);
const showJoin = ref(false);

function openCreateRoom() {
  showCreate.value = true;
}

watch(() => route.query.create, (val) => {
  if (val === 'true') {
    openCreateRoom();
  }
});

onMounted(() => {
  if (route.query.create === 'true') {
    openCreateRoom();
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-8 p-6">
    <img src="/images/share.png" alt="Albion Roads Mapper" class="w-full max-w-md md:max-w-3xl" />
    <h1 class="text-4xl font-bold text-indigo-400">Albion Roadmap</h1>
    <p class="text-gray-400 text-center max-w-md">
      Collaborate with your guild or friends in real-time to track Roads of Avalon portal connections. Track connections between your hideout, send alerts to your guild when enemies are near your hideout, easily find connections to the Royal Continent and Outlands.
    </p>

     <div class="flex gap-4">
      <button
        class="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium transition-colors"
        @click="openCreateRoom()"
      >
        Create Room
      </button>
      <button
        class="px-6 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 font-medium transition-colors"
        @click="showJoin = true"
      >
        Join Room
      </button>
    </div>
    <RecentlyViewedRooms />
  </div>

    <CreateRoomModal v-if="showCreate" @close="showCreate = false" />
    <JoinRoomModal v-if="showJoin" @close="showJoin = false" />
</template>
