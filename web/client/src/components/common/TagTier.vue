<script setup lang="ts">
import { computed } from 'vue';
import type { ZoneType } from 'shared';
import { getTierClasses } from '../../utils/colors';

const props = defineProps<{
  tier: number;
  type: ZoneType;
}>();

const classes = computed(() => getTierClasses(props.type));
</script>

<template>
  <span class="inline-flex items-center h-5 px-1 rounded text-white font-medium leading-none" :class="classes">
    T{{ tier }}
  </span>
</template>
