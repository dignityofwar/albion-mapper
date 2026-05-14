<script setup lang="ts">
import { computed } from 'vue';
import { ZONE_BUTTON_BG_HAS_REDS } from '../../../constants/ui';

const props = defineProps<{
  activeFeatures: { type: string; title: string; icon: string; smallCount?: number; largeCount?: number; count?: number; isResource: boolean; upstream?: boolean }[];
  hasReds: boolean;
}>();

const emit = defineEmits<{
  (e: 'edit'): void;
}>();

const featureRows = computed(() => {
  const all = props.activeFeatures;
  const rowSizes = [4, 3, 2];
  const rows: { type: string; title: string; icon: string; smallCount?: number; largeCount?: number; count?: number; isResource: boolean; upstream?: boolean }[][] = [];

  let current = 0;
  let sizeIndex = 0;
  while (current < all.length) {
    const size = rowSizes[sizeIndex] ?? 2;
    rows.push(all.slice(current, current + size));
    current += size;
    sizeIndex++;
  }

  return rows;
});
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-1 mt-1 max-w-[220px] mx-auto">
    <div v-if="activeFeatures.length === 0" class="callout" @click="$emit('edit')">
      No features!
    </div>
    <template v-else>
      <div v-if="!activeFeatures.some(f => f.isResource)" class="callout callout-gray" @click="$emit('edit')">
        Missing Resources
      </div>
    </template>
    <div v-for="(row, rowIndex) in featureRows" :key="rowIndex" class="flex items-center justify-center gap-1">
      <div 
        v-for="feature in row" 
        :key="feature.type"
        class="rounded flex items-stretch overflow-hidden relative"
        :class="hasReds ? ZONE_BUTTON_BG_HAS_REDS : 'bg-gray-700'"
        :title="feature.upstream ? feature.title + ' (upstream suggestion — please verify)' : feature.title"
      >
        <div class="flex items-center justify-center relative">
          <img :src="feature.icon" class="w-8 h-8 object-cover aspect-square p-1" :alt="feature.title" />
        </div>
        <!-- Non-resource: show count badge or ? if upstream -->
        <template v-if="!feature.isResource && (feature.count || feature.upstream)">
          <div
            class="flex items-center justify-center px-1 min-w-[18px]"
            :class="hasReds ? 'bg-red-600/60' : 'bg-gray-500/60'"
          >
            <span v-if="feature.upstream && !feature.count" class="text-[13px] font-bold text-white/50 leading-none">?</span>
            <span v-else class="text-[13px] font-bold text-white leading-none">{{ feature.count }}</span>
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
    <div v-if="activeFeatures.some(f => f.isResource) && !activeFeatures.some(f => !f.isResource)" class="callout callout-gray" @click="$emit('edit')">
      Missing Features
    </div>
  </div>
</template>

<style scoped>
@keyframes callout-pulse {
  0%, 100% {
    border-color: rgba(153, 27, 27, 0.6);
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0);
    color: rgba(220, 38, 38, 0.7);
  }
  50% {
    border-color: rgba(239, 68, 68, 0.9);
    box-shadow: 0 0 8px 2px rgba(220, 38, 38, 0.25);
    color: rgb(253 0 0);
  }
}

.callout {
  @apply text-[9px] uppercase font-bold tracking-widest px-3 py-1.5 rounded-lg border border-dashed bg-gray-800/20 border-red-800 text-red-600 cursor-pointer;
  animation: callout-pulse 5s ease-in-out infinite;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    @apply bg-red-900/60 border-red-400;
    animation: none;
    color: rgb(253 0 0);
  }

  &.callout-gray {
    @apply border-gray-500 text-gray-500 animate-none !important;
  }
}
</style>
