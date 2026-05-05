<script setup lang="ts">
import { computed } from 'vue';
import { ZONE_BUTTON_BG_HAS_REDS } from '../../../constants/ui';

const props = defineProps<{
  activeFeatures: { type: string; title: string; icon: string; size?: 'S' | 'L'; isResource: boolean }[];
  hasReds: boolean;
}>();

const emit = defineEmits<{
  (e: 'edit'): void;
}>();

const featureRows = computed(() => {
  const rows: { type: string; title: string; icon: string; size?: 'S' | 'L'; isResource: boolean }[][] = [];
  const limits = [4, 3, 2];
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
    <div v-if="activeFeatures.length === 0" 
      class="text-[9px] uppercase font-bold tracking-widest px-3 py-1.5 rounded-lg border border-dashed border-gray-700 text-gray-600 bg-gray-800/20"
    >
      No Features
    </div>
    <div v-for="(row, rowIndex) in featureRows" :key="rowIndex" class="flex items-center justify-center gap-1 h-8">
      <div 
        v-for="feature in row" 
        :key="feature.type"
        class="rounded flex items-stretch overflow-hidden h-8"
        :class="hasReds ? ZONE_BUTTON_BG_HAS_REDS : 'bg-gray-700'"
        :title="feature.title"
      >
        <div class="flex items-center justify-center h-full">
          <img :src="feature.icon" class="w-8 h-8 object-cover aspect-square p-1" :alt="feature.title" />
        </div>
        <div v-if="feature.size || feature.isResource" class="bg-gray-800/80 px-1 flex items-center justify-center h-full">
          <span v-if="feature.size" class="text-xs font-bold text-white">{{ feature.size }}</span>
          <span 
            v-else-if="feature.isResource" 
            @click.stop="$emit('edit')"
            class="text-xs font-bold text-white/50 cursor-pointer"
          >?</span>
        </div>
      </div>
    </div>
  </div>
</template>
