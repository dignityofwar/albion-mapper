<script setup lang="ts">
import { ref } from 'vue';
import { useRoomStore } from '../stores/useRoomStore';

const props = defineProps<{
  modelValue: boolean;
  error?: string;
  resetting?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'confirmed': [adminPassword: string];
}>();

const adminPassword = ref('');
const localError = ref('');

function close() {
  emit('update:modelValue', false);
  adminPassword.value = '';
  localError.value = '';
}

function confirm() {
  localError.value = '';
  if (!adminPassword.value.trim()) {
    localError.value = 'Admin password is required';
    return;
  }
  emit('confirmed', adminPassword.value);
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999]"
    @click.self="close"
  >
    <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md" @click.stop>
      <h2 class="text-xl font-semibold mb-4">Confirm Reset</h2>
      <p class="text-sm text-gray-400 mb-4">Are you sure you want to reset all connections? This cannot be undone. Enter admin password to confirm.</p>
      <div class="flex flex-col gap-4">
        <div>
          <label class="block text-sm text-gray-400 mb-1">Admin Password</label>
          <input
            v-model="adminPassword"
            type="password"
            placeholder="Admin password"
            class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white outline-none"
            @keydown.enter="confirm"
          />
        </div>
        <p v-if="localError || error" class="text-red-400 text-sm">{{ localError || error }}</p>
        <div class="flex gap-2">
          <button
            class="flex-1 px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
            @click="confirm"
            :disabled="resetting"
          >
            {{ resetting ? 'Resetting...' : 'Reset' }}
          </button>
          <button
            class="flex-1 px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
            @click="close"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
