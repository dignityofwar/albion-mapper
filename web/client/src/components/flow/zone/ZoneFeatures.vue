<script setup lang="ts">
import { computed } from 'vue';
import { ZONE_BUTTON_BG_HAS_REDS } from '../../../constants/ui';

const props = defineProps<{
  activeFeatures: { type: string; title: string; icon: string }[];
  hasReds: boolean;
}>();

const featureRows = computed(() => {
  const rows: { type: string; title: string; icon: string }[][] = [];
  const limits = [5, 4, 3];
  let current = 0;
  
  for (const limit of limits) {
    if (current >= props.activeFeatures.length) break;
    rows.push(props.activeFeatures.slice(current, current + limit));
    current += limit;
  }
  
  if (current < props.activeFeatures.length) {
    rows.push(props.activeFeatures.slice(current));
  }
  
  return rows;
});
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-1 mt-1 max-w-[220px] mx-auto">
    <div v-for="(row, rowIndex) in featureRows" :key="rowIndex" class="flex items-center justify-center gap-1">
      <div 
        v-for="feature in row" 
        :key="feature.type"
        class="rounded p-1 flex items-center justify-center"
        :class="hasReds ? ZONE_BUTTON_BG_HAS_REDS : 'bg-gray-700'"
        :title="feature.title"
      >
        <img :src="feature.icon" class="w-5 h-5 object-contain" />
      </div>
    </div>
  </div>
</template>
