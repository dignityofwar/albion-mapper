<script setup lang="ts">
import { ref } from 'vue';
import { useRoomStore } from '../stores/useRoomStore';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const importData = ref('');
const store = useRoomStore();

function close() {
  emit('update:modelValue', false);
  importData.value = '';
}

async function pasteFromClipboard() {
  try {
    importData.value = await navigator.clipboard.readText();
  } catch (err) {
    alert('Failed to read from clipboard');
  }
}

function importDataAction() {
  try {
    const data = JSON.parse(importData.value);
    store.importData(data)
      .then(() => {
        close();
        window.location.reload();
      })
      .catch((e) => {
        alert('Failed to import: ' + (e instanceof Error ? e.message : 'Unknown error'));
      });
  } catch (e) {
    alert('Invalid JSON: ' + (e instanceof Error ? e.message : 'Unknown error'));
  }
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999]"
    @click.self="close"
  >
    <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md" @click.stop>
      <h2 class="text-xl font-semibold mb-4">Import Data</h2>
      
      <textarea
        v-model="importData"
        class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white outline-none h-40 mb-4 font-mono text-xs"
        placeholder="Paste JSON data here..."
      ></textarea>
      
      <div class="flex gap-2">
        <button
          class="flex-1 px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
          @click="pasteFromClipboard"
        >
          Paste from Clipboard
        </button>
        <button
          class="flex-1 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
          @click="importDataAction"
        >
          Import
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
</template>
