<script setup lang="ts">
import { ZONE_BUTTON_BG_DEFAULT, ZONE_BUTTON_BG_HAS_REDS, ZONE_BUTTON_HOVER_DEFAULT, ZONE_BUTTON_HOVER_HAS_REDS, ZONE_BUTTON_BG_ACTIVE_HAS_REDS, ZONE_BUTTON_RING_ACTIVE_HAS_REDS, ZONE_BUTTON_HOVER_REDS, ZONE_BUTTON_HOVER_INACTIVE, ZONE_BUTTON_HOVER_ACTIVE } from '../../../constants/ui';
import type { NodeFeatures } from 'shared';

const props = defineProps<{
  type: keyof NodeFeatures;
  active: boolean;
  hasReds?: boolean;
  title: string;
}>();

defineEmits<{
  (e: 'toggle'): void;
}>();

const getImageSrc = (type: string) => {
  switch (type) {
    case 'crystalCreaturePresent': return '/images/crystal.png';
    case 'dungeonStatic': return '/images/dungeon-static.png';
    case 'dungeonGroup': return '/images/dungeon-group.png';
    case 'chest': return '/images/chest.png';
    case 'treasuresGreen': return '/images/treasures-green.png';
    case 'treasuresBlue': return '/images/treasures-blue.png';
    case 'treasuresYellow': return '/images/treasures-yellow.png';
    case 'resourceFibre': return '/images/resource-fibre.png';
    case 'resourceLeather': return '/images/resource-leather.png';
    case 'resourceOre': return '/images/resource-ore.png';
    case 'resourceStone': return '/images/resource-stone.png';
    case 'resourceWood': return '/images/resource-wood.png';
    default: return '';
  }
};
</script>

<template>
  <button 
    @click.stop="$emit('toggle')" 
    :class="[
      active 
        ? (hasReds ? `${ZONE_BUTTON_BG_ACTIVE_HAS_REDS} ${ZONE_BUTTON_RING_ACTIVE_HAS_REDS} ring-1 hover:bg-red-500` : `bg-gray-600 ring-white ring-1 ${ZONE_BUTTON_HOVER_ACTIVE}`) 
        : (hasReds ? `${ZONE_BUTTON_BG_HAS_REDS} ${ZONE_BUTTON_HOVER_REDS}` : `${ZONE_BUTTON_BG_DEFAULT} ${ZONE_BUTTON_HOVER_INACTIVE}`),
      'text-white rounded p-1 ring-inset leading-none transition-colors flex items-center justify-center'
    ]"
    :title="title"
  >
    <img :src="getImageSrc(type)" class="w-6 h-6 p-[2px]" :alt="title" />
  </button>
</template>
