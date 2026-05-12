<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import CreateRoomModal from '../components/CreateRoomModal.vue';
import RecentlyViewedRooms from '../components/RecentlyViewedRooms.vue';

const route = useRoute();

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
  <div class="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center">
    <div class="w-full max-w-md md:max-w-3xl flex flex-col gap-4 items-center">
      <img src="/images/share.png" alt="Albion Roads Mapper" class="w-full" />
      <h1 class="text-4xl font-bold text-indigo-400 text-center">Albion Roadmap</h1>
      <p class="text-gray-400 text-center">
        Collaborate with your guild or friends in real-time to track Roads of Avalon portal connections. Locate and track Cores, Map Resources (and sizes), Avalonian Chests, Treasure Chests with real time-timers and easily find connections to the Royal Continent and Outlands portal and rest zones.
      </p>
      <p class="text-gray-400 text-center">
        All Rooms are secured with a password, which you can rotate at any time. Hideout location data is never shared with anyone else without the password.
      </p>

      <div class="flex gap-4 justify-center w-full">
        <button
          class="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium transition-colors"
          @click="openCreateRoom()"
        >
          Create Room
        </button>
      </div>
    </div>

    <RecentlyViewedRooms />
  </div>

    <CreateRoomModal v-if="showCreate" @close="showCreate = false" />
</template>
