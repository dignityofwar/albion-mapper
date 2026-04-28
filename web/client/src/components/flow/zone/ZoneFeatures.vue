<script setup lang="ts">
import { ZONE_BUTTON_BG_HAS_REDS } from '../../../constants/ui';

defineProps<{
  activeFeatures: { type: string; title: string; icon: string }[];
  hasReds: boolean;
}>();
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-1 mt-4">
    <template v-if="activeFeatures.length > 0">
      <div 
        v-for="feature in activeFeatures" 
        :key="feature.type"
        class="rounded p-1 flex items-center justify-center"
        :class="hasReds ? ZONE_BUTTON_BG_HAS_REDS : 'bg-gray-700'"
        :title="feature.title"
      >
        <img :src="feature.icon" class="w-4 h-4 object-contain" />
      </div>
    </template>
    <div v-else class="bg-gray-700/20 rounded px-2 py-1 text-[10px] text-gray-400/50 italic h-[24px] flex items-center">
      No map features
    </div>
  </div>
</template>
