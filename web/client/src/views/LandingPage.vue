<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import CreateRoomModal from '../components/CreateRoomModal.vue';
import CopyrightNotice from '../components/CopyrightNotice.vue';
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
  { name: "Adding Zones", start: 0, end: 10 },
  { name: "Updating Map Portals", start: 10, end: 21 },
  { name: "Updating Map Features", start: 21, end: 89 },
  { name: "Editing Connections", start: 89, end: 122 },
  { name: "Searching zones", start: 122, end: 148 },
  { name: "Real-Time Sync", start: 148, end: 186 },
  { name: "Route Plotting", start: 186, end: 222 },
  { name: "Map Summaries", start: 222, end: 268 },
];

const activeChapterName = computed(() => {
  const chapter = chapters.find(c => currentTime.value >= c.start && currentTime.value < c.end);
  return chapter ? chapter.name : chapters[0].name;
});

const dropdownValue = ref<string>(chapters[0].name);

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

const onChapterChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const selectedName = target.value;
  dropdownValue.value = selectedName;
  const chapter = chapters.find(c => c.name === selectedName);
  if (chapter) {
    jumpToChapter(chapter);
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

watch(activeChapterName, (name) => {
  dropdownValue.value = name;
});

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
     <div class="w-full max-w-md md:max-w-3xl flex flex-col gap-4 items-center">
      <h1 class="text-4xl font-bold text-indigo-600 text-center">Albion Roads Mapper</h1>
      <p class="text-white text-center">Created by <a href="https://discord.gg/t372jvcsZn" class="text-indigo-400 hover:underline" target="_blank">[DIG]</a> Maelstrome</p>
        <div class="flex gap-4">
          <button
            class="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium transition-colors"
            @click="openCreateRoom()"
          >
            Create Room
          </button>
          <a
            href="https://discord.gg/uFq2PJuZ3r"
            target="_blank"
            class="px-6 py-3 rounded-lg bg-[#5865F2] hover:bg-indigo-500 font-medium transition-colors text-center"
          >
            Discord
          </a>
        </div>
      <RecentlyViewedRooms />
      <p class="text-gray-400 text-center">
        Collaborate with your guild <b>real-time</b> to track Roads of Avalon portal zones and map content. Locate and track Cores and Treasure Chests with real time-timers, Map Resources (and sizes), Avalonian Chests, and easily find connections to the Royal Continent, Outlands portals and rest zones.
      </p>
      <p class="text-gray-400 text-center">
        All Rooms are secured with a password, which you can rotate at any time.
      </p>
    </div>
    <div class="w-full max-w-[2000px] mt-4 min-[1200px]:mt-0 min-[1200px]:px-24 min-[1200px]:pt-4 pb-10">
      <video
        ref="videoRef"
        src="/demo2.mp4"
        autoplay
        loop
        muted
        playsinline
        controls
        @play="startAnimation"
        @pause="stopAnimation"
        @ended="stopAnimation"
        class="w-full min-[1200px]:border-2 min-[1200px]:border-gray-500 min-[1200px]:rounded-lg"
      />
      <div class="mt-4 w-full px-4 min-[1200px]:px-0 text-center">
        <select
          :value="dropdownValue"
          @change="onChapterChange"
          @focus="stopAnimation"
          @blur="startAnimation"
          class="min-[1200px]:hidden w-64 mb-4 p-3 bg-gray-900 text-white rounded-lg border border-gray-700 text-center"
        >
          <option v-for="chapter in chapters" :key="chapter.name" :value="chapter.name">
            {{ chapter.name }}
          </option>
        </select>
        <div class="hidden min-[1200px]:flex gap-2">
          <button
            v-for="chapter in chapters"
            :key="chapter.name"
            class="flex-1 flex flex-col gap-1 cursor-pointer group"
            @click="jumpToChapter(chapter)"
          >
            <div class="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                class="bg-indigo-500 h-full transition-all duration-300 ease-linear"
                :style="{ width: getChapterProgress(chapter) }"
              ></div>
            </div>
            <div
              class="w-full text-xs text-center truncate transition-colors group-hover:text-white"
              :class="currentTime >= chapter.start && currentTime < chapter.end ? 'text-white' : 'text-gray-500'"
            >
              {{ chapter.name }}
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
  <CreateRoomModal v-if="showCreate" @close="showCreate = false" />
  <div class="fixed bottom-2 left-0 right-0 text-center pointer-events-none">
    <CopyrightNotice />
  </div>
</template>
