<script setup lang="ts">
import { ref, shallowRef, onBeforeUnmount, computed, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import CopyrightNotice from '../components/CopyrightNotice.vue';
import RecentlyViewedRooms from '../components/RecentlyViewedRooms.vue';
// v1.2 splash retired with v1.3 (kept for reference / future announcements)
// import V1dot2SplashModal from '../components/version-announcements/V1dot2SplashModal.vue';

const router = useRouter();

// const splashModal = ref<InstanceType<typeof V1dot2SplashModal> | null>(null);

// The demo used to be a self-hosted 240MB mp4 streamed from the API, autoplaying
// on page load. It now lives on YouTube, and nothing third-party is fetched until
// the poster below is clicked.
const YOUTUBE_VIDEO_ID = 'RhNaLbwat-8';

// Minimal shape of the bits of the IFrame Player API we touch.
interface YouTubePlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  getCurrentTime(): number;
  destroy(): void;
}

interface YouTubeApi {
  Player: new (el: HTMLElement, options: Record<string, unknown>) => YouTubePlayer;
  PlayerState: { PLAYING: number };
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Best-first. maxres (1280x720, native 16:9) only exists once YouTube has
// finished the HD transcode; the smaller two are 4:3 with letterbox bars, which
// `object-cover` crops back off exactly. hqdefault is always present.
const THUMBNAIL_SIZES = ['maxresdefault', 'sddefault', 'hqdefault'];
const thumbnailSizeIndex = ref(0);
const thumbnailSrc = computed(
  () => `https://i.ytimg.com/vi/${YOUTUBE_VIDEO_ID}/${THUMBNAIL_SIZES[thumbnailSizeIndex.value]}.jpg`,
);
const nextThumbnailSize = () => {
  if (thumbnailSizeIndex.value < THUMBNAIL_SIZES.length - 1) {
    thumbnailSizeIndex.value += 1;
  }
};

// A missing size 404s but still returns a decodable 120x90 grey placeholder, so
// the browser fires `load`, not `error` — the size is the only tell.
const onThumbnailLoad = (event: Event) => {
  const img = event.target as HTMLImageElement;
  if (img.naturalWidth <= 120) {
    nextThumbnailSize();
  }
};

const playerHost = ref<HTMLDivElement | null>(null);
const playerWrapper = ref<HTMLDivElement | null>(null);
// shallowRef: a plain ref would hand back a reactive Proxy of the player, and the
// IFrame API does not appreciate being wrapped.
const player = shallowRef<YouTubePlayer | null>(null);
const hasStarted = ref(false);
const currentTime = ref(0);

interface Chapter {
  name: string;
  start: number;
  end: number;
}

const chapters: Chapter[] = [
  { name: "Adding Zones", start: 0, end: 30 },
  { name: "Rotating Maps & Portal Edits", start: 30, end: 50 },
  { name: "Link Zone Portal", start: 50, end: 81 },
  { name: "Editing Connections", start: 81, end: 91 },
  { name: "Map Features", start: 91, end: 129 },
  { name: "Map History", start: 129, end: 148 },
  { name: "Cores, Chests & Dungeons", start: 148, end: 206 },
  { name: "Links Expiry", start: 206, end: 235 },
  { name: "Search", start: 235, end: 250 },
  { name: "Pinging & Reds", start: 250, end: 278 },
  { name: "Real-Time Sync", start: 278, end: 305 },
  { name: "Route Plotting", start: 305, end: 333 },
  { name: "Room History", start: 333, end: 360 },
  { name: "Room Management", start: 360, end: 999 },
];

const activeChapterName = computed(() => {
  const chapter = chapters.find(c => currentTime.value >= c.start && currentTime.value < c.end);
  return chapter ? chapter.name : chapters[0].name;
});

const dropdownValue = ref<string>(chapters[0].name);

// The chapter bars track playback position; 4Hz is plenty given the 300ms CSS
// transition on the fill, and avoids a rAF loop for a value that barely moves.
let pollTimer: ReturnType<typeof setInterval> | null = null;

const startAnimation = () => {
  if (pollTimer || !player.value) return;
  pollTimer = setInterval(() => {
    if (player.value) {
      currentTime.value = player.value.getCurrentTime();
    }
  }, 250);
};

const stopAnimation = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

// Loaded on demand, once, and shared by every caller racing to start playback.
let apiPromise: Promise<void> | null = null;

const loadYouTubeApi = (): Promise<void> => {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });

  return apiPromise;
};

// Set for the whole async gap between the first click and the player existing,
// so a second click in that window seeks rather than building a second player.
let pendingStart: number | null = null;

const startPlayback = async (startSeconds = 0) => {
  // Already playing: just seek.
  if (player.value) {
    player.value.seekTo(startSeconds, true);
    player.value.playVideo();
    return;
  }

  if (pendingStart !== null) {
    pendingStart = startSeconds;
    return;
  }
  pendingStart = startSeconds;

  hasStarted.value = true;
  await loadYouTubeApi();
  await nextTick();

  if (!window.YT || !playerHost.value) {
    pendingStart = null;
    return;
  }

  // A chapter clicked while the API was loading wins over the original click.
  const startAt = Math.floor(pendingStart ?? startSeconds);
  pendingStart = null;

  // The API replaces the host element with its iframe, so it must be a leaf node
  // Vue never patches.
  player.value = new window.YT.Player(playerHost.value, {
    host: 'https://www.youtube-nocookie.com',
    videoId: YOUTUBE_VIDEO_ID,
    playerVars: {
      autoplay: 1,
      start: startAt,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
    },
    events: {
      onReady: () => startAnimation(),
      onStateChange: (event: { data: number }) => {
        if (event.data === window.YT?.PlayerState.PLAYING) {
          startAnimation();
        } else {
          stopAnimation();
        }
      },
    },
  });
};

const jumpToChapter = (chapter: Chapter) => {
  void startPlayback(chapter.start);
  currentTime.value = chapter.start;

  if (playerWrapper.value) {
    const offset = 10;
    const elementPosition = playerWrapper.value.getBoundingClientRect().top;
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

watch(activeChapterName, (name) => {
  dropdownValue.value = name;
});

onBeforeUnmount(() => {
  stopAnimation();
  player.value?.destroy();
  player.value = null;
});
</script>

<style scoped>
.btn-pulsate {
  animation: pulsate 5s ease-in-out infinite;
}

@keyframes pulsate {
  0%, 100% { box-shadow: 0 4px 32px 8px rgba(99, 102, 241, 1); }
  50% { box-shadow: 0 4px 32px 8px rgba(99, 102, 241, 0.4); }
}
</style>

<template>
  <div class="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-start pt-4 relative overflow-x-hidden">
    <div class="w-full flex justify-center px-4 mb-4">
      <div class="w-full max-w-3xl bg-indigo-900/40 border border-indigo-500/50 rounded-lg p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg backdrop-blur-sm">
        <div class="flex items-center gap-3">
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-white animate-pulse">
            ✨
          </span>
          <div>
            <p class="font-bold text-indigo-100">Update v1.3 is here!</p>
            <p class="text-xs text-indigo-200/80">Rooms are now lockable! Admins can lock a room to make it read-only for everyone else — find it under the ⚙️ settings cog in your room.</p>
          </div>
        </div>
        <!-- v1.3 has no splash modal — announcement lives in the in-room settings cog CTA
        <button
          @click="splashModal?.show()"
          class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-md transition-all shadow-md active:scale-95"
        >
          See What's New
        </button>
        -->
      </div>
    </div>

    <div class="w-full max-w-md md:max-w-3xl flex flex-col gap-4 items-center px-4">
      <h1 class="text-4xl font-bold text-indigo-600 text-center">Albion Online Roads Mapper</h1>
      <RecentlyViewedRooms />
      <p class="text-white text-center">
        Collaborate with your guildmates in <b>real-time</b> to track Roads of Avalon portal zones and map content. Locate and track Cores and Treasure Chests with real time-timers, Map Resources (and sizes), Avalonian Chests, and easily find connections to the Royal Continent, Outlands portals and rest zones.
      </p>
      <p class="text-white text-center">
        You are able to set your starting location from a Hideout Zone in the Roads, Royal Continent, Outlands of even Brecilien, and relocate it whenever you choose.
      </p>
      <p class="text-white text-center">
        All Rooms are secured with a password, which you can rotate at any time.
      </p>
       <p class="text-gray-400 text-center">Created by <a href="https://discord.gg/t372jvcsZn" class="text-indigo-400 hover:underline" target="_blank">[DIG]</a> <a href="https://github.com/Maelstromeous/Maelstromeous" class="text-indigo-400 hover:underline" target="_blank">Maelstrome</a></p>
    </div>

    <div class="flex flex-col items-center gap-6 mb-4 mt-4">
        <button
          class="px-10 py-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 border border-blue-400 hover:border-blue-300 font-bold text-xl transition-colors duration-500 btn-pulsate"
          @click="router.push('/create')"
        >
          Create Room
        </button>
        <div class="flex gap-2">
           <a
          href="https://discord.gg/uFq2PJuZ3r"
          target="_blank"
          class="px-4 py-2 rounded-lg bg-[#5865F2] hover:bg-indigo-500 border border-transparent hover:border hover:border-blue-300 font-medium text-sm transition-colors text-center duration-500 flex items-center gap-2"
        >
          <img src="/images/discord.png" alt="Discord" class="h-5 w-auto" />
          Discord
        </a>
        <a
          href="https://github.com/dignityofwar/albionroads"
          target="_blank"
          class="px-4 py-1.5 rounded-lg bg-gray-600 hover:bg-gray-500 border border-transparent hover:border hover:border-gray-300 font-medium text-sm transition-colors text-center duration-500"
        >
          GitHub
        </a>
        </div>

      </div>
    <div class="w-full max-w-[2000px] mt-4 min-[1200px]:mt-0 min-[1200px]:px-24 min-[1200px]:pt-4 pb-10 overflow-hidden">
      <div class="mb-4 w-full px-4 min-[1200px]:px-0 text-center">
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
        <div class="hidden min-[1200px]:flex gap-2 flex-wrap max-w-full">
          <template v-for="(chapter, index) in chapters" :key="chapter.name">
            <div v-if="index === 7" class="w-full min-[1700px]:hidden"></div>
            <button
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
          </template>
        </div>
      </div>
      <div
        ref="playerWrapper"
        class="relative w-full aspect-video bg-black overflow-hidden min-[1200px]:border-2 min-[1200px]:border-gray-500 min-[1200px]:rounded-lg"
      >
        <!-- Poster facade: no YouTube script, cookies or iframe until it's clicked. -->
        <button
          v-if="!hasStarted"
          type="button"
          class="group absolute inset-0 w-full h-full cursor-pointer"
          aria-label="Play the Albion Roads Mapper demo video"
          @click="startPlayback(0)"
        >
          <img
            :src="thumbnailSrc"
            alt=""
            width="1280"
            height="720"
            class="w-full h-full object-cover"
            @load="onThumbnailLoad"
            @error="nextThumbnailSize"
          />
          <span class="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/10"></span>
          <span
            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-20 h-14 rounded-2xl bg-black/70 transition-colors group-hover:bg-red-600"
          >
            <svg class="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
        <!-- Replaced wholesale by the API's iframe; keep it free of bindings. -->
        <div v-else class="w-full h-full">
          <div ref="playerHost" class="w-full h-full"></div>
        </div>
      </div>
    </div>
    <div class="w-full text-center pb-8 pointer-events-none">
      <CopyrightNotice class="pointer-events-auto" />
    </div>
    <!-- <V1dot2SplashModal ref="splashModal" /> -->
  </div>
</template>
