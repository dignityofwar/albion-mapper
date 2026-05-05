<script setup lang="ts">
import { Z_INDEX } from '@/constants/Layers';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'confirmed': [];
}>();

function close() {
  emit('update:modelValue', false);
}

function confirm() {
  emit('confirmed');
  close();
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 bg-black/60 flex items-center justify-center p-4"
    :class="Z_INDEX.MODAL"
    @click.self="close"
  >
    <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md" @click.stop>
      <h2 class="text-xl font-semibold mb-2">Are you sure you wish to wipe all data?</h2>
      <p class="text-sm text-gray-400 mb-6">This cannot be recovered and all the room's data will be reset. Zone Memory will persist however.</p>
      <div class="flex gap-3 justify-end">
        <button
          class="px-5 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white font-medium transition-colors"
          @click="close"
        >
          No
        </button>
        <button
          class="px-5 py-2 rounded bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
          @click="confirm"
        >
          Yes
        </button>
      </div>
    </div>
  </div>
</template>
