<script setup lang="ts">
import { ZoneType } from 'shared';
import TagZone from '../../common/TagZone.vue';
import TagTier from '../../common/TagTier.vue';

defineProps<{
  zoneName?: string;
  id: string;
  isHome?: boolean;
  type: ZoneType;
  category?: string;
  mapShape?: string;
  tier?: number;
  compact?: boolean;
  proximityTo?: string;
  slots?: 7 | 20;
  onToggleSlots?: () => void;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center">
    <div 
      class="font-bold flex items-center leading-tight mb-1"
      :class="compact ? 'text-base' : 'text-sm'"
    >
      {{ zoneName || id }}
      <span v-if="isHome" class="ml-1">🏠</span>
    </div>
    <div class="flex items-center gap-1.5" :class="{ 'scale-75 origin-top': compact }">
      <TagTier v-if="tier" :tier="tier" :type="type" />
      <TagZone :type="type" :category="category" :map-shape="mapShape" :proximity-to="proximityTo" :zone-name="zoneName" />
      <button
        v-if="onToggleSlots"
        class="inline-flex items-center h-5 px-1.5 rounded font-semibold text-[10px] whitespace-nowrap leading-none border transition-colors"
        :class="slots === 7 ? 'bg-sky-900/60 border-gray-400 text-sky-200 hover:bg-sky-900/80' : slots === 20 ? 'bg-yellow-800/60 border-gray-400 text-yellow-200 hover:bg-yellow-800/80' : 'bg-gray-700 border-gray-400 text-gray-300 hover:bg-gray-600'"
        title="Toggle slots (7 or 20)"
        @click.stop="onToggleSlots"
      >
        {{ slots !== undefined ? slots + 's' : '?s' }}
      </button>
    </div>
  </div>
</template>
m