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
  <span class="px-1 rounded text-white font-medium" :class="classes">
    T{{ tier }}
  </span>
</template>
