<script setup lang="ts">
import { computed } from 'vue';
import { ZONE_BUTTON_BG_HAS_REDS } from '../../../constants/ui';

const props = defineProps<{
  activeFeatures: { type: string; title: string; icon: string; smallCount?: number; largeCount?: number; count?: number; isResource: boolean }[];
  hasReds: boolean;
}>();

const emit = defineEmits<{
  (e: 'edit'): void;
}>();

const featureRows = computed(() => {
  const resources = props.activeFeatures.filter(f => f.isResource);
  const others = props.activeFeatures.filter(f => !f.isResource);

  const rows: { type: string; title: string; icon: string; smallCount?: number; largeCount?: number; count?: number; isResource: boolean }[][] = [];

  if (resources.length > 0) {
    rows.push(resources.slice(0, 3));
  }

  // Pack non-resource features into rows of up to 4
  let current = 0;
  while (current < others.length) {
    rows.push(others.slice(current, current + 4));
    current += 4;
  }

  return rows;
});
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-1 mt-1 max-w-[220px] mx-auto">
    <div v-if="activeFeatures.length === 0" 
      class="text-[9px] uppercase font-bold tracking-widest px-3 py-1.5 rounded-lg border border-dashed border-gray-700 text-gray-600 bg-gray-800/20"
    >
      None
    </div>
    <template v-else>
      <div v-if="!activeFeatures.some(f => f.isResource)" 
        class="text-[9px] uppercase font-bold tracking-widest px-3 py-1.5 rounded-lg border border-dashed border-gray-700 text-gray-600 bg-gray-800/20"
      >
        No Resources Logged
      </div>
    </template>
    <div v-for="(row, rowIndex) in featureRows" :key="rowIndex" class="flex items-center justify-center gap-1">
      <div 
        v-for="feature in row" 
        :key="feature.type"
        class="rounded flex items-stretch overflow-hidden"
        :class="hasReds ? ZONE_BUTTON_BG_HAS_REDS : 'bg-gray-700'"
        :title="feature.title"
      >
        <div class="flex items-center justify-center">
          <img :src="feature.icon" class="w-8 h-8 object-cover aspect-square p-1" :alt="feature.title" />
        </div>
        <!-- Non-resource: show count badge if available -->
        <template v-if="!feature.isResource && feature.count">
          <div
            class="flex items-center justify-center px-1 min-w-[18px]"
            :class="hasReds ? 'bg-red-600/60' : 'bg-gray-500/60'"
          >
            <span class="text-[13px] font-bold text-white leading-none">{{ feature.count }}</span>
          </div>
        </template>
        <!-- Resource: show stacked count + size label for each size that has entries -->
        <template v-if="feature.isResource">
          <template v-if="(feature.smallCount ?? 0) > 0 || (feature.largeCount ?? 0) > 0">
            <div
              v-if="(feature.smallCount ?? 0) > 0"
              class="flex flex-col items-center justify-center px-0.5 min-w-[18px]"
              :class="hasReds ? 'bg-red-600/60' : 'bg-gray-500/60'"
            >
              <span class="text-[14px] font-bold text-white leading-none">{{ feature.smallCount }}</span>
              <span class="text-[10px] font-bold text-white/70 leading-none mt-0.5">S</span>
            </div>
            <div
              v-if="(feature.largeCount ?? 0) > 0"
              class="flex flex-col items-center justify-center px-0.5 min-w-[18px]"
              :class="[(feature.smallCount ?? 0) > 0 ? 'border-l border-gray-400' : '', hasReds ? 'bg-red-600/60' : 'bg-gray-500/60']"
            >
              <span class="text-[14px] font-bold text-white leading-none">{{ feature.largeCount }}</span>
              <span class="text-[10px] font-bold text-white/70 leading-none mt-0.5">L</span>
            </div>
          </template>
          <div
            v-else
            class="flex items-center justify-center px-1"
            :class="hasReds ? 'bg-red-600/60' : 'bg-gray-500/60'"
            @click.stop="$emit('edit')"
          >
            <span class="text-xs font-bold text-white/50 cursor-pointer">?</span>
          </div>
        </template>
      </div>
    </div>
    <div v-if="activeFeatures.some(f => f.isResource) && !activeFeatures.some(f => !f.isResource)" 
      class="text-[9px] uppercase font-bold tracking-widest px-3 py-1.5 rounded-lg border border-dashed border-gray-700 text-gray-600 bg-gray-800/20"
    >
      Missing Chests Etc
    </div>
  </div>
</template>
