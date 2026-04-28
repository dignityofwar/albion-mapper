<script setup lang="ts">
import type { NodeFeatures } from 'shared';

const props = defineProps<{
  type: keyof NodeFeatures;
  active: boolean;
  title: string;
}>();

defineEmits<{
  (e: 'toggle'): void;
}>();

const getImageSrc = (type: string) => {
  switch (type) {
    case 'crystalCreaturePresent': return '/images/crystal.png';
    case 'chest': return '/images/chest.png';
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
    :class="active ? 'bg-gray-600 border-white' : 'bg-gray-700 border-transparent'" 
    class="text-white rounded p-1 border leading-none transition-colors hover:opacity-80 flex items-center justify-center" 
    :title="title"
  >
    <img :src="getImageSrc(type)" class="w-6 h-6 p-[2px]" :alt="title" />
  </button>
</template>
