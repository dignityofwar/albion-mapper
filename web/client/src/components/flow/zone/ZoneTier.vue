<script setup lang="ts">
import { ZoneType } from 'shared';
import TagTier from '../../common/TagTier.vue';

defineProps<{
  tier: number;
  type: ZoneType;
}>();
</script>

<template>
  <div class="absolute z-10 -top-[1px] -left-[1px]">
    <TagTier :tier="tier" :type="type" class="!rounded-tr-none !rounded-bl-none py-6 w-6" />
  </div>
</template>
