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
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center">
    <div class="font-bold text-sm flex items-center leading-tight mb-1">
      {{ zoneName || id }}
      <span v-if="isHome" class="ml-1">🏠</span>
    </div>
    <div class="flex items-center gap-1.5">
      <TagTier v-if="tier" :tier="tier" :type="type" />
      <TagZone :type="type" :category="category" :map-shape="mapShape" />
    </div>
  </div>
</template>
