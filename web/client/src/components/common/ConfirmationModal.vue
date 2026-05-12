<script setup lang="ts">
import { Z_INDEX } from '@/constants/Layers';

defineProps<{
  modelValue: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'confirm': [];
}>();

function close() {
  emit('update:modelValue', false);
}

function confirm() {
  emit('confirm');
  close();
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/60 flex items-center justify-center p-4"
      :class="Z_INDEX.MODAL"
      @click.self="close"
    >
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl" @click.stop>
        <h2 class="text-xl font-semibold mb-2 text-white">{{ title }}</h2>
        <p class="text-sm text-gray-400 mb-6">{{ message }}</p>
        <div class="flex gap-3 justify-end">
          <button
            class="px-5 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white font-medium transition-colors"
            @click="close"
          >
            {{ cancelText || 'No' }}
          </button>
          <button
            class="px-5 py-2 rounded font-medium transition-colors"
            :class="danger ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'"
            @click="confirm"
          >
            {{ confirmText || 'Yes' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
