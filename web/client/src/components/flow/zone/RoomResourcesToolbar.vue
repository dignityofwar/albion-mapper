<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ZoneType } from 'shared';
import ResourceZoneSummary from './ResourceZoneSummary.vue';

export type ResourceType = 'fibre' | 'leather' | 'ore' | 'stone' | 'wood';

export interface ResourceZone {
  zoneId: string;
  zoneName: string;
  tier: number;
  type: ZoneType;
  size?: 'S' | 'L';
}

const props = defineProps<{
  fibre: ResourceZone[];
  leather: ResourceZone[];
  ore: ResourceZone[];
  stone: ResourceZone[];
  wood: ResourceZone[];
  alwaysExpanded?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', zoneId: string): void;
}>();

const activeTab = ref<ResourceType | null>(null);

// Flash state per button (counter increments to force animation restart)
const flash = ref<Record<string, number>>({
  fibre: 0, leather: 0, ore: 0, stone: 0, wood: 0,
});

function triggerFlash(key: string) {
  flash.value[key]++;
}

watch(() => props.fibre.length,   (n, o) => { if (o !== undefined && n !== o) triggerFlash('fibre'); });
watch(() => props.leather.length, (n, o) => { if (o !== undefined && n !== o) triggerFlash('leather'); });
watch(() => props.ore.length,     (n, o) => { if (o !== undefined && n !== o) triggerFlash('ore'); });
watch(() => props.stone.length,   (n, o) => { if (o !== undefined && n !== o) triggerFlash('stone'); });
watch(() => props.wood.length,    (n, o) => { if (o !== undefined && n !== o) triggerFlash('wood'); });
function toggleTab(tab: ResourceType) {
  activeTab.value = activeTab.value === tab ? null : tab;
}

const tabs: { type: ResourceType; label: string; icon: string }[] = [
  { type: 'fibre',   label: 'Cotton',  icon: '/images/resource-fibre.png'   },
  { type: 'leather', label: 'Leather', icon: '/images/resource-leather.png' },
  { type: 'ore',     label: 'Ore',     icon: '/images/resource-ore.png'     },
  { type: 'stone',   label: 'Stone',   icon: '/images/resource-stone.png'   },
  { type: 'wood',    label: 'Wood',    icon: '/images/resource-wood.png'    },
];

function getZones(tab: ResourceType): ResourceZone[] {
  return props[tab];
}

const activeZones = computed(() => activeTab.value ? getZones(activeTab.value) : []);
const activeLabel = computed(() => tabs.find(t => t.type === activeTab.value)?.label ?? '');

const totalCount = computed(() => ({
  fibre:   props.fibre.length,
  leather: props.leather.length,
  ore:     props.ore.length,
  stone:   props.stone.length,
  wood:    props.wood.length,
}));
</script>

<template>
  <div :class="alwaysExpanded ? 'flex flex-col items-stretch gap-3 pointer-events-none w-full' : 'flex flex-col md:flex-row items-stretch md:items-start gap-3 pointer-events-none w-full md:w-auto'">
    <!-- Toolbar -->
    <div :class="alwaysExpanded ? 'flex flex-col gap-2 frosted-background border border-gray-700/50 rounded-xl p-2 shadow-2xl pointer-events-auto justify-center relative transition-all duration-300' : 'flex flex-row md:flex-col gap-2 frosted-background border border-gray-700/50 rounded-xl p-2 shadow-2xl pointer-events-auto justify-center relative transition-all duration-300'">
      <div :class="alwaysExpanded ? 'flex flex-col gap-2' : 'flex flex-row md:flex-col gap-2'">
        <button
          v-for="tab in tabs"
          :key="tab.type"
          @click="toggleTab(tab.type)"
          :disabled="totalCount[tab.type] === 0"
          :class="[
            alwaysExpanded ? 'flex-none' : 'flex-1 md:flex-none',
            'flex items-center justify-center gap-2 p-2 rounded-lg transition-all duration-200 border disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden btn-flash-wrap',
            activeTab === tab.type
              ? 'bg-indigo-600/20 border-indigo-500/50 hover:bg-indigo-600/30 hover:border-indigo-400/60'
              : (totalCount[tab.type] > 0
                  ? 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/60 hover:border-gray-500'
                  : 'bg-gray-800/50 border-transparent'),
          ]"
          :title="tab.label"
        >
          <span v-if="flash[tab.type] > 0" :key="flash[tab.type]" class="btn-flash-overlay" />
          <img :src="tab.icon" class="w-6 h-6 object-contain" :alt="tab.label" />
          <span class="text-lg font-bold text-gray-300 min-w-[12px] text-center">
            {{ totalCount[tab.type] }}
          </span>
        </button>
      </div>
    </div>

    <!-- Detail Panel -->
    <Transition name="fade" mode="out-in">
      <div 
        v-if="activeTab !== null && activeZones.length > 0"
        :key="activeTab"
        class="relative frosted-background border border-gray-700/50 rounded-xl p-3 shadow-2xl pointer-events-auto w-full md:w-64 flex flex-col"
      >
        <div class="text-sm uppercase text-gray-400 font-bold mb-3 px-1 flex items-center justify-between">
          <span>{{ activeLabel }}</span>
          <span class="bg-gray-800 text-xs px-2 py-0.5 rounded text-gray-400 border border-gray-700">
            {{ activeZones.length }}
          </span>
        </div>

        <button 
          @click="activeTab = null"
          class="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 items-center justify-center rounded-full bg-gray-700 border border-gray-600 text-xs shadow-md z-20 pointer-events-auto hover:border-white transition-colors duration-300"
        >
          ◀
        </button>

        <div class="max-h-[calc(100vh-150px)] overflow-y-auto pr-1">
          <ResourceZoneSummary
            :zones="activeZones"
            @select="emit('select', $event)"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-fast-enter-active,
.fade-fast-leave-active {
  transition: opacity 0.2s ease;
}
.fade-fast-enter-from,
.fade-fast-leave-to {
  opacity: 0;
}

.btn-flash-wrap {
  position: relative;
}
.btn-flash-overlay {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: white;
  pointer-events: none;
  animation: btn-update-flash 2s ease-out forwards;
}
@keyframes btn-update-flash {
  0%   { opacity: 0.35; }
  15%  { opacity: 0.35; }
  100% { opacity: 0; }
}
</style>
