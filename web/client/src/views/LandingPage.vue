<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import CreateRoomModal from '../components/CreateRoomModal.vue';
import RecentlyViewedRooms from '../components/RecentlyViewedRooms.vue';

const route = useRoute();

const showCreate = ref(false);
const showJoin = ref(false);

const videoRef = ref<HTMLVideoElement | null>(null);
const currentTime = ref(0);

interface Chapter {
  name: string;
  start: number;
  end: number;
}

const chapters: Chapter[] = [
  { name: "Adding a zone", start: 0, end: 19 },
  { name: "Updating Map Features", start: 19, end: 48 },
  { name: "Updating Map Portals", start: 48, end: 65 },
  { name: "Updating hideouts", start: 65, end: 98 },
  { name: "Searching zones", start: 98, end: 106 },
  { name: "Editing Connections", start: 106, end: 126 },
  { name: "Route plotting", start: 126, end: 161 },
  { name: "Toolbar navigation", start: 161, end: 182 },
];

const onTimeUpdate = () => {
  if (videoRef.value) {
    currentTime.value = videoRef.value.currentTime;
  }
};

let animationFrameId: number | null = null;

const updateTimeLoop = () => {
  if (videoRef.value) {
    currentTime.value = videoRef.value.currentTime;
    animationFrameId = requestAnimationFrame(updateTimeLoop);
  }
};

const startAnimation = () => {
  if (!animationFrameId) {
    updateTimeLoop();
  }
};

const stopAnimation = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};

const jumpToChapter = (chapter: Chapter) => {
  if (videoRef.value) {
    videoRef.value.currentTime = chapter.start;
    const offset = 10;
    const elementPosition = videoRef.value.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.scrollY - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }
};

const getChapterProgress = (chapter: Chapter) => {
  if (currentTime.value <= chapter.start) return '0%';
  if (currentTime.value >= chapter.end) return '100%';
  const duration = chapter.end - chapter.start;
  return ((currentTime.value - chapter.start) / duration) * 100 + '%';
};

function openCreateRoom() {
  showCreate.value = true;
}

watch(() => route.query.create, (val) => {
  if (val === 'true') {
    openCreateRoom();
  }
});

onMounted(() => {
  if (videoRef.value) {
    startAnimation();
  }
  if (route.query.create === 'true') {
    openCreateRoom();
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center pt-4">
    <h1 class="text-4xl font-bold text-indigo-400 text-center">Albion Roads Mapper</h1>
    <p class="text-white text-center">Created by <a href="https://discord.gg/joindig" class="text-indigo-400 hover:underline" target="_blank">[DIG]</a> Maelstrome</p>
    <div class="w-full px-24 py-4">
      <video
        ref="videoRef"
        src="/demo.mp4"
        autoplay
        loop
        muted
        playsinline
        controls
        @play="startAnimation"
        @pause="stopAnimation"
        @ended="stopAnimation"
        class="w-full border-2 border border-gray-500 rounded-lg"
      />
      <div class="mt-4 w-full flex flex-col gap-1">
        <div class="w-full flex gap-2 h-2">
          <div v-for="chapter in chapters" :key="chapter.name" class="flex-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              class="bg-indigo-500 h-full transition-all duration-300 ease-linear"
              :style="{ width: getChapterProgress(chapter) }"
            ></div>
          </div>
        </div>
        <div class="w-full flex gap-2 text-xs">
          <button
            v-for="chapter in chapters"
            :key="chapter.name"
            class="flex-1 text-center truncate cursor-pointer transition-colors"
            :class="currentTime >= chapter.start && currentTime < chapter.end ? 'text-white' : 'text-gray-500'"
            @click="jumpToChapter(chapter)"
          >
            {{ chapter.name }}
          </button>
        </div>
      </div>
    </div>

    <div class="w-full max-w-md md:max-w-3xl flex flex-col gap-4 items-center">
       <button
          class="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium transition-colors"
          @click="openCreateRoom()"
        >
          Create Room
        </button>
      <p class="text-gray-400 text-center">
        Collaborate with your guild or friends in <b>real-time</b> to track Roads of Avalon portal connections and map content. Locate and track Cores, Map Resources (and sizes), Avalonian Chests, Treasure Chests with real time-timers and easily find connections to the Royal Continent and Outlands portal and rest zones.
      </p>
      <p class="text-gray-400 text-center">
        All Rooms are secured with a password, which you can rotate at any time. Hideout location data is never shared with anyone else without the password.
      </p>
    </div>

    <RecentlyViewedRooms />
  </div>

    <CreateRoomModal v-if="showCreate" @close="showCreate = false" />
</template>
