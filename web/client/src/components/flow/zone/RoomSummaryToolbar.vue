<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useTutorialStore } from '../../../stores/useTutorialStore';
import ActiveCoreSummary from './ActiveCoreSummary.vue';

const tutorialStore = useTutorialStore();

interface ZoneFeatureInfo {
  zoneId: string;
  zoneName: string;
  type?: string;
}

interface ActiveCore extends ZoneFeatureInfo {
  expiresAt: number;
  coreType: 'green' | 'blue' | 'purple' | 'yellow';
}

const props = withDefaults(defineProps<{
  cores: ActiveCore[];
  crystals: ZoneFeatureInfo[];
  dungeons: ZoneFeatureInfo[];
  chests: ZoneFeatureInfo[];
  alwaysExpanded?: boolean;
}>(), {
  alwaysExpanded: false
});

const emit = defineEmits<{
  (e: 'select', zoneId: string): void;
}>();

type ViewType = 'cores' | 'crystals' | 'dungeons' | 'chests';
const userClosedCores = ref(false);
const activeView = ref<ViewType | null>(null);
const userExpanded = ref(true);
const contentVisible = ref(true);
const isExpanded = computed(() => props.alwaysExpanded || userExpanded.value);

watch(() => props.alwaysExpanded, (newVal) => {
  if (newVal) {
    userExpanded.value = true;
    contentVisible.value = true;
  }
});

async function toggleExpanded() {
  if (props.alwaysExpanded) return;

  if (userExpanded.value) {
    // Closing
    contentVisible.value = false;
    userExpanded.value = false;
  } else {
    // Opening
    userExpanded.value = true;
    await new Promise(r => setTimeout(r, 300));
    contentVisible.value = true;
  }
}

watch(() => props.cores.length, (newCount, oldCount) => {
  if (newCount > 0 && (oldCount === 0 || oldCount === undefined) && !userClosedCores.value) {
    activeView.value = 'cores';
  } else if (newCount === 0 && activeView.value === 'cores') {
    activeView.value = null;
  }
}, { immediate: true });

const coreCounts = computed(() => {
  const counts = { green: 0, blue: 0, purple: 0, yellow: 0 };
  props.cores.forEach(c => counts[c.coreType]++);
  return counts;
});

const totalCount = computed(() => {
  return {
    cores: props.cores.length,
    crystals: props.crystals.length,
    dungeons: props.dungeons.length,
    chests: props.chests.length,
  };
});

function hasItems(view: ViewType | null): view is ViewType {
  return view !== null && totalCount.value[view] > 0;
}

const currentList = computed(() => {
  switch (activeView.value) {
    case 'crystals': return props.crystals;
    case 'dungeons': return props.dungeons;
    case 'chests': return props.chests;
    default: return [];
  }
});

const viewTitles: Record<ViewType, string> = {
  cores: 'Active Cores',
  crystals: 'Crystals',
  dungeons: 'Dungeons',
  chests: 'Treasures',
};

function getItemIcon(item: ZoneFeatureInfo) {
  if (activeView.value === 'crystals') return '/images/crystal.png';
  if (activeView.value === 'dungeons') {
    return item.type === 'static' ? '/images/dungeon-static.png' : '/images/dungeon-group.png';
  }
  if (activeView.value === 'chests') {
    if (item.type === 'blue') return '/images/treasures-blue.png';
    if (item.type === 'yellow') return '/images/treasures-yellow.png';
    if (item.type === 'chest') return '/images/chest.png';
    return '/images/treasures-green.png';
  }
  return '';
}

function toggleView(view: ViewType) {
  if (tutorialStore.step === 15) {
    tutorialStore.setStep(16);
  }
  if (activeView.value === view) {
    activeView.value = null;
    if (view === 'cores') {
      userClosedCores.value = true;
    }
  } else {
    activeView.value = view;
    if (view === 'cores') {
      userClosedCores.value = false;
    }
  }
}

function handleSelect(zoneId: string) {
  if (tutorialStore.step === 15) {
    tutorialStore.setStep(16);
  }
  emit('select', zoneId);
}
</script>

<template>
  <div class="flex flex-col md:flex-row-reverse items-stretch md:items-start gap-3 pointer-events-none w-full md:w-auto">
    <!-- Toolbar -->
    <div class="flex flex-row md:flex-col gap-2 bg-gray-900/95 border border-gray-700 rounded-xl p-2 shadow-2xl backdrop-blur-md pointer-events-auto justify-center relative transition-all duration-300">
      <!-- Toggle Button -->
      <button 
        v-if="!alwaysExpanded"
        @click="toggleExpanded"
        class="absolute -left-3 top-2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-700 border border-gray-600 text-xs shadow-md z-10"
      >
        {{ isExpanded ? '◀' : '▶' }}
      </button>

      <Transition name="slide">
        <div v-if="isExpanded" class="flex flex-row md:flex-col gap-2">
          <!-- Cores Button -->
          <button 
            @click="toggleView('cores')"
            :disabled="totalCount.cores === 0"
            class="flex-1 md:flex-none flex items-center justify-center gap-2 p-2 rounded-lg transition-all border disabled:opacity-40 disabled:cursor-not-allowed"
            :class="[
              activeView === 'cores' ? 'bg-indigo-600/20 border-indigo-500/50' : (totalCount.cores > 0 ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-800/50 border-transparent enabled:hover:bg-gray-700/50'),
              !isExpanded ? 'px-2' : ''
            ]"
            title="Active Cores"
          >
            <img src="/images/core-green.png" class="w-6 h-6 object-contain" />
            <Transition name="fade">
              <div v-if="contentVisible" class="flex items-center text-base font-bold leading-none whitespace-nowrap">
                <span class="text-green-500">{{ coreCounts.green }}</span>
                <span class="text-gray-500 mx-0.5">-</span>
                <span class="text-blue-500">{{ coreCounts.blue }}</span>
                <span class="text-gray-500 mx-0.5">-</span>
                <span class="text-purple-500">{{ coreCounts.purple }}</span>
              </div>
            </Transition>
          </button>

          <!-- Crystals Button -->
          <button 
            @click="toggleView('crystals')"
            :disabled="totalCount.crystals === 0"
            class="flex-1 md:flex-none flex items-center justify-center gap-2 p-2 rounded-lg transition-all border disabled:opacity-40 disabled:cursor-not-allowed"
            :class="[
              activeView === 'crystals' ? 'bg-indigo-600/20 border-indigo-500/50' : (totalCount.crystals > 0 ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-800/50 border-transparent enabled:hover:bg-gray-700/50'),
              !isExpanded ? 'px-2' : ''
            ]"
            title="Crystals"
          >
            <img src="/images/crystal.png" class="w-6 h-6 object-contain" />
            <Transition name="fade">
              <span v-if="contentVisible" class="text-base font-bold text-gray-300 min-w-[12px] text-center">{{ totalCount.crystals }}</span>
            </Transition>
          </button>

          <!-- Dungeons Button -->
          <button 
            @click="toggleView('dungeons')"
            :disabled="totalCount.dungeons === 0"
            class="flex-1 md:flex-none flex items-center justify-center gap-2 p-2 rounded-lg transition-all border disabled:opacity-40 disabled:cursor-not-allowed"
            :class="[
              activeView === 'dungeons' ? 'bg-indigo-600/20 border-indigo-500/50' : (totalCount.dungeons > 0 ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-800/50 border-transparent enabled:hover:bg-gray-700/50'),
              !isExpanded ? 'px-2' : ''
            ]"
            title="Dungeons"
          >
            <img src="/images/dungeon-group.png" class="w-6 h-6 object-contain" />
            <Transition name="fade">
              <span v-if="contentVisible" class="text-base font-bold text-gray-300 min-w-[12px] text-center">{{ totalCount.dungeons }}</span>
            </Transition>
          </button>

          <!-- Chests Button -->
          <button 
            @click="toggleView('chests')"
            :disabled="totalCount.chests === 0"
            class="flex-1 md:flex-none flex items-center justify-center gap-2 p-2 rounded-lg transition-all border disabled:opacity-40 disabled:cursor-not-allowed"
            :class="[
              activeView === 'chests' ? 'bg-indigo-600/20 border-indigo-500/50' : (totalCount.chests > 0 ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-800/50 border-transparent enabled:hover:bg-gray-700/50'),
              !isExpanded ? 'px-2' : ''
            ]"
            title="Chests"
          >
            <img src="/images/treasures-green.png" class="w-6 h-6 object-contain" />
            <Transition name="fade">
              <span v-if="contentVisible" class="text-base font-bold text-gray-300 min-w-[12px] text-center">{{ totalCount.chests }}</span>
            </Transition>
          </button>
        </div>
      </Transition>
    </div>

    <!-- Active Detail Panel -->
    <Transition name="fade" mode="out-in">
      <div 
        v-if="isExpanded && hasItems(activeView)"
        :key="activeView"
        class="bg-gray-900/95 border border-gray-700 rounded-xl p-3 shadow-2xl backdrop-blur-md pointer-events-auto w-full md:w-64 flex flex-col"
      >
        <div class="text-xs uppercase text-gray-400 font-bold mb-3 px-1 flex items-center justify-between">
          <span>{{ viewTitles[activeView] }}</span>
          <span class="bg-gray-800 text-[10px] px-1.5 py-0.5 rounded text-gray-400 border border-gray-700">
            {{ totalCount[activeView] }}
          </span>
        </div>

        <div class="max-h-[calc(100vh-150px)] overflow-y-auto pr-1 flex flex-col-reverse">
          <ActiveCoreSummary 
            v-if="activeView === 'cores'"
            :cores="cores" 
            compact 
            @select="handleSelect($event)"
          />
          
          <div v-else class="flex flex-col gap-1.5">
            <button 
              v-for="item in currentList" 
              :key="`${item.zoneId}-${item.type}`"
              @click="handleSelect(item.zoneId)"
              class="flex items-center gap-3 px-2.5 py-2 rounded bg-gray-800/50 hover:bg-gray-700/50 transition-colors text-left border border-gray-700 group"
            >
              <div class="w-5 h-5 flex items-center justify-center shrink-0">
                 <img :src="getItemIcon(item)" class="w-full h-full object-contain" />
              </div>
              <span class="text-sm font-medium truncate group-hover:text-indigo-300">
                {{ item.zoneName }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
</style>
