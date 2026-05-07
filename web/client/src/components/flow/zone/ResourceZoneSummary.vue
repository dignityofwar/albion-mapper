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
      class="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-white cursor-pointer bg-gray-800/50 hover:bg-gray-700/50 transition-colors text-left rounded border border-gray-700 group"
    >
      <TagTier :tier="zone.tier" :type="zone.type" />
      <span class="truncate flex-1 font-medium group-hover:text-white">
        {{ zone.zoneName }}
      </span>
      <span
        class="shrink-0 text-xs font-bold text-gray-300 bg-gray-950 border border-gray-700 rounded px-1.5 py-0.5 leading-none"
      >
        {{ zone.size ?? '?' }}
      </span>
    </button>
  </div>
</template>
