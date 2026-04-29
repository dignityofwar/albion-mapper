<script setup lang="ts">
import { inject, type Ref, ref } from 'vue';
import IconUnlocked from '../../icons/IconUnlocked.vue';

interface ActiveCore {
  zoneId: string;
  zoneName: string;
  expiresAt: number;
  coreType: 'green' | 'blue' | 'purple' | 'yellow';
}

defineProps<{
  cores: ActiveCore[];
  compact?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', zoneId: string): void;
}>();

const now = inject<Ref<number>>('globalNow', ref(Date.now()));

function formatTimerMMSS(expiresAtMs: number): string {
  const remaining = Math.max(0, Math.floor((expiresAtMs - now.value) / 1000));
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const config = {
  green: { img: '/images/core-green.png', borderClass: 'border-green-500' },
  blue: { img: '/images/core-blue.png', borderClass: 'border-blue-500' },
  purple: { img: '/images/core-purple.png', borderClass: 'border-purple-500' },
  yellow: { img: '/images/core-yellow.png', borderClass: 'border-yellow-500' },
};
</script>

<template>
  <div class="flex flex-col" :class="compact ? 'gap-1.5' : 'gap-2'">
    <button 
      v-for="core in cores" 
      :key="`${core.zoneId}-${core.coreType}`"
      @click="emit('select', core.zoneId)"
      class="flex items-center justify-between transition-colors text-left border"
      :class="[
        compact ? 'gap-3 px-2.5 py-2 rounded bg-gray-800 hover:bg-gray-700 group' : 'gap-4 px-3 py-2 rounded-lg bg-gray-800 active:bg-gray-700',
        config[core.coreType].borderClass
      ]"
    >
      <div class="flex items-center min-w-0" :class="compact ? 'gap-2' : 'gap-3'">
        <img :src="config[core.coreType].img" :class="compact ? 'w-5 h-5 p-[2px]' : 'w-8 h-8 p-[2px]'" />
        <span 
          class="text-sm truncate" 
          :class="compact ? 'font-medium group-hover:text-indigo-300' : 'font-bold'"
        >
          {{ core.zoneName }}
        </span>
      </div>
      <span 
        class="rounded shrink-0 flex items-center justify-center transition-colors"
        :class="[
          core.expiresAt > now ? 'bg-gray-950 border border-gray-700' : 'bg-transparent border-transparent',
          compact ? 'text-xs px-1.5 py-0.5 text-gray-300 min-w-[45px] h-6' : 'text-sm px-2 py-1 font-bold text-indigo-300 min-w-[55px] h-8'
        ]"
      >
        <template v-if="core.expiresAt > now">
          {{ formatTimerMMSS(core.expiresAt) }}
        </template>
        <IconUnlocked v-else class="text-green-500" />
      </span>
    </button>
  </div>
</template>
