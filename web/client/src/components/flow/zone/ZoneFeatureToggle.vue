<script setup lang="ts">
import { computed } from 'vue';
import { ZONE_BUTTON_BG_DEFAULT, ZONE_BUTTON_BG_HAS_REDS, ZONE_BUTTON_HOVER_DEFAULT, ZONE_BUTTON_HOVER_HAS_REDS, ZONE_BUTTON_BG_ACTIVE_HAS_REDS, ZONE_BUTTON_RING_ACTIVE_HAS_REDS, ZONE_BUTTON_HOVER_REDS, ZONE_BUTTON_HOVER_INACTIVE, ZONE_BUTTON_HOVER_ACTIVE } from '../../../constants/ui';
import type { NodeFeatures } from 'shared';

const props = defineProps<{
  type: keyof NodeFeatures;
  active: boolean;
  hasReds?: boolean;
  title: string;
  size?: 'S' | 'L';
}>();

defineEmits<{
  (e: 'toggle'): void;
  (e: 'size', type: keyof NodeFeatures, size: 'S' | 'L'): void;
}>();

const isResource = computed(() => props.type.startsWith('resource'));

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
      'text-white rounded ring-inset leading-none transition-colors flex items-center justify-center'
    ]"
    :title="title"
  >
    <img :src="getImageSrc(type)" class="w-16 h-16 py-2 object-contain" :alt="title" />
    <div v-if="isResource" class="flex flex-col h-16">
      <button @click.stop="$emit('size', type, 'S')" class="px-1.5 rounded-t hover:bg-black/50 flex-1 flex items-center justify-center text-[10px] border-b border-white/10" :class="size === 'S' ? 'bg-gray-500' : 'bg-black/30'">S</button>
      <button @click.stop="$emit('size', type, 'L')" class="px-1.5 rounded-b hover:bg-black/50 flex-1 flex items-center justify-center text-[10px]" :class="size === 'L' ? 'bg-gray-500' : 'bg-black/30'">L</button>
    </div>
  </button>
</template>
