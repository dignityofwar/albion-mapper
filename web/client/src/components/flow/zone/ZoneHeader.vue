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
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center relative">
    <img v-if="isHome" src="/images/hideout.png" class="absolute -top-12 w-8 h-10" />
    <div 
      class="font-bold flex items-center leading-tight mb-1 text-lg"
    >
      {{ zoneName || id }}
    </div>
    <div class="flex items-center gap-1.5" :class="{ 'scale-75 origin-top': compact }">
      <TagTier v-if="tier" :tier="tier" :type="type" />
      <TagZone :type="type" :category="category" :map-shape="mapShape" :proximity-to="proximityTo" :zone-name="zoneName" />
    </div>
  </div>
</template>
m