<script setup lang="ts">
const props = defineProps<{
  type: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple';
  active: boolean;
  editing: boolean;
  borderClass?: string;
  label?: string;
}>();

defineEmits<{
  (e: 'toggle'): void;
}>();

const config = {
  powercoreGreen: { title: 'Green Core', img: '/images/core-green.png', colorClass: 'bg-green-700', hoverClass: 'hover:bg-green-500' },
  powercoreBlue: { title: 'Blue Core', img: '/images/core-blue.png', colorClass: 'bg-blue-700', hoverClass: 'hover:bg-blue-500' },
  powercorePurple: { title: 'Purple Core', img: '/images/core-purple.png', colorClass: 'bg-purple-700', hoverClass: 'hover:bg-purple-500' },
};
</script>

<template>
  <button 
    @click.stop="$emit('toggle')" 
    :class="[
      active ? config[type].colorClass : 'bg-gray-700',
      active ? borderClass : 'border-transparent',
      editing ? 'ring-1 ring-white' : '',
      config[type].hoverClass
    ]" 
    class="text-white rounded p-1 border leading-none transition-colors flex items-center" 
    :title="config[type].title"
  >
    <img :src="config[type].img" class="w-6 h-6 p-[2px]" />
    <span v-if="label" class="mx-1 text-[12px] leading-none">{{ label }}</span>
  </button>
</template>
