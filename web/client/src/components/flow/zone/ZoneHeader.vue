<script setup lang="ts">
import { ZoneType } from 'shared';
import TagZone from '../../common/TagZone.vue';

defineProps<{
  zoneName?: string;
  id: string;
  isHome?: boolean;
  type: ZoneType;
  category?: string;
}>();
</script>

<template>
  <div class="font-bold text-sm flex items-center justify-center leading-tight">
    {{ zoneName || id }}
    <span v-if="isHome" class="ml-1">🏠</span>
  </div>
  <div class="flex items-center justify-center mt-2">
    <TagZone :type="type" :category="category" />
  </div>
</template>
