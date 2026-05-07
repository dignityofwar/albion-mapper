<script setup lang="ts">
import { ZoneType } from 'shared';
import TagTier from '../../common/TagTier.vue';

const props = defineProps<{
  zones: { zoneId: string; zoneName: string; tier: number; type: ZoneType; size?: 'S' | 'L' }[];
}>();

const emit = defineEmits<{
  (e: 'select', zoneId: string): void;
}>();
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <button
      v-for="zone in zones"
      :key="zone.zoneId"
      @click="emit('select', zone.zoneId)"
      class="flex items-center justify-between gap-3 px-2.5 py-2 rounded bg-gray-800/50 hover:bg-gray-700/50 transition-colors text-left border border-gray-700 group"
    >
      <div class="flex items-center gap-2">
        <TagTier :tier="zone.tier" :type="zone.type" />
        <span class="text-sm font-medium truncate group-hover:text-indigo-300">
          {{ zone.zoneName }}
        </span>
      </div>
      <span
        class="shrink-0 text-[16px] font-bold text-gray-300 bg-gray-950 border border-gray-700 rounded px-2 py-0.5 leading-none"
      >
        {{ zone.size ?? '?' }}
      </span>
    </button>
  </div>
</template>
