<script setup lang="ts">
import { ref, computed } from 'vue';
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent, TooltipPortal } from 'reka-ui';
import { useRoomStore } from '@/stores/useRoomStore';
import { useRoomMemoryStore } from '@/stores/useRoomMemoryStore';
import { usePlotRouteStore } from '@/stores/usePlotRouteStore';
import { storeToRefs } from 'pinia';
import { Z_INDEX } from '@/constants/Layers';

const SPLASH_SEEN_KEY = 'splash:v12:seen';
const CTA_DISMISSED_KEY = 'cta:chainManagement:dismissed';

const store = useRoomStore();
const memoryStore = useRoomMemoryStore();
const { nodePositions, connections } = storeToRefs(store);

const hasMapHistory = computed(() =>
  memoryStore.memory.size > 0
);

const hasOpenedChainManager = computed(() =>
  typeof localStorage !== 'undefined' && localStorage.getItem(CTA_DISMISSED_KEY) === '1'
);

const hasSeen = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem(SPLASH_SEEN_KEY) === '1'
);

const currentSlide = ref(0);

const slides = [
  {
    id: 'chains',
    title: 'Map Chains',
    image: '/images/changelog/1.2/chains.png',
    hasCta: true,
  },
  {
    id: 'routing',
    title: 'Route Plotting',
    image: '/images/changelog/1.2/routes.png',
    hasCta: true,
  },
  {
    id: 'roomrename',
    title: 'Room Renaming',
    image: '/images/changelog/1.2/roomrename.png',
    hasCta: false,
  },
  {
    id: 'other',
    title: 'Other changes',
    image: undefined,
    hasCta: false,
    fixes: [
      'Zone rotation desync bug fixed for good!',
      'Zones are longer wrongly marked as "explored" by changing the connecting time/portal.',
      'Fixed Cieos-Atatlum\'s map type (O shape, not C shape). Please report any other map categorisation oddies on Discord!',
      'Fixed misaligned connection lines on zone handles.',
    ],
    improvements: [
      'It is now possible for two zones to be connected via two portal pairs. When this occurs, it uses the same "direction" as the preexisting connection.',
      'Added Discord image to the Discord buttons.',
      'Improved some of the blue hints to be less obtuse and less in your face.',
      'Added changelog "slideshows" for new updates.'
    ],
  }
];

const manualVisible = ref(false);

const visible = computed(() =>
  manualVisible.value || (!hasSeen.value && hasMapHistory.value && !hasOpenedChainManager.value)
);

function nextSlide() {
  if (currentSlide.value < slides.length - 1) {
    currentSlide.value++;
  } else {
    dismiss();
  }
}

function prevSlide() {
  if (currentSlide.value > 0) {
    currentSlide.value--;
  }
}

function dismiss() {
  manualVisible.value = false;
  hasSeen.value = true;
  try { localStorage.setItem(SPLASH_SEEN_KEY, '1'); } catch { /* ignore */ }
}

function show() {
  currentSlide.value = 0;
  manualVisible.value = true;
}

defineExpose({
  show
});

function openChainManager() {
  dismiss();
  store.openChainManagement();
}

function startRoutePlot() {
  dismiss();
  usePlotRouteStore().enterPlotRouteMode();
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="fixed inset-0 bg-black/70 flex items-center justify-center p-2 md:p-8"
        :class="Z_INDEX.MODAL"
        @click.self="dismiss"
      >
        <div
          class="relative bg-gray-900 border border-gray-700 rounded-xl p-4 md:p-6 w-full md:max-w-5xl shadow-2xl overflow-y-auto max-h-full"
          @click.stop
        >
        <!-- Close button -->
        <button
          class="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors text-lg leading-none"
          title="Dismiss"
          @click="dismiss"
        >✕</button>

        <div class="text-center mb-6">
          <span class="text-lg font-bold uppercase tracking-widest text-indigo-400">
            What's new in v1.2
          </span>
        </div>

        <div class="flex flex-col gap-4 mb-4">
          <!-- Image -->
          <div v-if="slides[currentSlide].image" class="rounded-lg overflow-hidden bg-black w-full border-2 border-gray-700 shadow-inner flex justify-center">
            <img
              class="max-w-full h-auto object-contain"
              :src="slides[currentSlide].image"
              :alt="slides[currentSlide].title"
            />
          </div>

          <!-- Title below image -->
          <div class="flex justify-between items-end">
            <div>
              <h1 class="text-3xl font-bold text-white">{{ slides[currentSlide].title }}</h1>
            </div>
          </div>

          <!-- Content -->
          <div class="w-full">
            <!-- Chain Management -->
            <div v-if="slides[currentSlide].id === 'chains'" class="space-y-4">
              <p class="text-base text-gray-300 leading-relaxed">
                Chains let you create <strong>multiple independent groups of zones</strong> within a single room — perfect for exploring outwards from Outlands, Royal Continent or Brecilien into Roads of Avalon. Each chain has its own source zone and updatable colour.
              </p>
              <div class="flex flex-col gap-3">
                <p class="text-base text-gray-300 leading-relaxed">
                  Rooms can now be created using <strong>Royal Continent, Outlands zones or Brecilien</strong>! You can update your primary zone anytime in the manager.
                  <TooltipProvider :delay-duration="0">
                    <TooltipRoot>
                      <TooltipTrigger as-child>
                        <span class="text-yellow-500 underline decoration-dotted cursor-help ml-1">Note: two chains cannot be linked together.</span>
                      </TooltipTrigger>
                      <TooltipPortal>
                        <TooltipContent
                          class="bg-gray-950 border border-gray-700 text-gray-200 text-xs px-3 py-2 rounded shadow-xl z-[10000] max-w-xs"
                          side="top"
                        >
                          Route plotting and connection deletions both use tree-traversal algorithms that require loop-free graphs. In Roads of Avalon, two zones can be joined by more than one portal pair, which would create a cycle.<br><br>Keeping chains strictly separate eliminates the risk of unintended data loss.
                        </TooltipContent>
                      </TooltipPortal>
                    </TooltipRoot>
                  </TooltipProvider>
                </p>
                
                <div class="flex justify-center">
                  <button
                    class="px-4 py-2 mt-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors flex items-center gap-2 shadow-lg"
                    @click="openChainManager"
                  >
                    Open Chain Manager ⛓️
                  </button>
                </div>
              </div>
            </div>

            <!-- Route Plotting -->
            <div v-if="slides[currentSlide].id === 'routing'" class="space-y-4">
              <p class="text-base text-gray-300 leading-relaxed">
                Plan your journey efficiently with the improved route plotting tool. Click any two zones on the map to find the shortest path between them, taking into account portal types and connection status. Perfect for coordinating group movements through the mists or roads.
              </p>
              <p class="text-base text-gray-300 leading-relaxed">
                <span class="text-yellow-500">Routes can only be plotted amongst the same chain.</span> Only one route is allowed at any one time.
              </p>
              <div class="flex justify-center">
                <button
                  class="px-4 py-2 mt-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors flex items-center gap-2 shadow-lg"
                  @click="startRoutePlot"
                >
                  Start a Route Plot 🗺️
                </button>
              </div>
            </div>

            <!-- Route Plotting -->
            <div v-if="slides[currentSlide].id === 'roomrename'" class="space-y-4">
              <p class="text-base text-gray-300 leading-relaxed">
                It is now possible to rename your room. Simply hover over the name, click on it, and you'll be prompted to rename it. Everyone who's viewing the room will instantly get the name change.
              </p>
              <p class="text-base leading-relaxed text-yellow-500">
                 <strong>The admin password is required</strong> to rename the room.
              </p>
            </div>
            <div v-if="slides[currentSlide].id === 'other'" class="w-full space-y-6">
              <div v-if="slides[currentSlide].fixes?.length">
                <h3 class="text-xl font-semibold text-red-400 mb-2">🔧 Fixes</h3>
                <ul class="list-disc list-outside ml-6 space-y-2 text-gray-300 text-lg">
                  <li v-for="fix in slides[currentSlide].fixes" :key="fix">
                    {{ fix }}
                  </li>
                </ul>
              </div>

              <div v-if="slides[currentSlide].improvements?.length">
                <h3 class="text-xl font-semibold text-indigo-400 mb-2">✨ Improvements</h3>
                <ul class="list-disc list-outside ml-6 space-y-2 text-gray-300 text-lg">
                  <li v-for="imp in slides[currentSlide].improvements" :key="imp">
                    {{ imp }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-between items-center pt-4 border-t border-gray-800">
          <button
            v-if="currentSlide > 0"
            class="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors flex items-center gap-2 max-w-[40%]"
            @click="prevSlide"
          >
            ← {{ slides[currentSlide - 1].title }}
          </button>
          <div v-else></div>

          <div class="flex items-center gap-4">
            <div class="text-gray-500 text-sm font-medium whitespace-nowrap">
              {{ currentSlide + 1 }} / {{ slides.length }}
            </div>
            <button
              class="px-6 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors flex items-center gap-2 shadow-lg"
              @click="nextSlide"
            >
              <template v-if="currentSlide === slides.length - 1">
                Close
              </template>
              <template v-else>
                {{ slides[currentSlide + 1].title }} →
              </template>
            </button>
          </div>
        </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
