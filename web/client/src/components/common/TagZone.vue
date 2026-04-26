<script setup lang="ts">
import { computed } from 'vue';
import type { ZoneType } from 'shared';
import { getZoneTypeDisplay } from '../../utils/zoneStyles';

const props = defineProps<{
  type: ZoneType;
  label?: string;
}>();

const display = computed(() => {
  const d = getZoneTypeDisplay(props.type);
  return { ...d, label: props.label ?? d.label };
});
</script>

<template>
  <span class="px-1 rounded text-white font-semibold" :class="display.class">
    {{ display.label }}
  </span>
</template>
