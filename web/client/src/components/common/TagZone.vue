<script setup lang="ts">
import { computed } from 'vue';
import type { ZoneType } from 'shared';
import { getZoneTypeDisplay } from '../../utils/zoneStyles';
import { FACTION_MAP } from '../../utils/factions';

const props = defineProps<{
  type: ZoneType;
  label?: string;
  category?: string;
  mapShape?: string;
  proximityTo?: string;
  zoneName?: string;
}>();

const display = computed(() => {
  let labelToUse = props.proximityTo || props.category;

  if (labelToUse && FACTION_MAP[labelToUse]) {
    const faction = FACTION_MAP[labelToUse];
    return {
      label: labelToUse,
      style: { 
        backgroundColor: faction.bgColor,
        borderColor: faction.borderColor
      },
      class: 'border'
    };
  }
  const d = getZoneTypeDisplay(props.type, props.mapShape);
  return { ...d, label: props.label ?? d.label, style: {}, class: d.class };
});
</script>

<template>
  <span class="inline-flex items-center h-5 px-1 rounded text-white font-semibold whitespace-nowrap leading-none" :class="display.class" :style="display.style">
    {{ display.label }}
  </span>
</template>
