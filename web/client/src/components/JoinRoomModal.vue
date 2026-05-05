<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { track } from '@vercel/analytics';

const emit = defineEmits<{ close: [] }>();

const router = useRouter();
const joinInput = ref('');

function joinRoom() {
  const value = joinInput.value.trim();
  if (!value) return;
  // Accept full URL or bare id
  const match = value.match(/rooms\/([^/?#]+)/);
  const id = match ? match[1] : value;
  track('join_room');
  emit('close');
  router.push(`/rooms/${id}`);
}
</script>

<template>
  <div
    class="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
    @click.self="emit('close')"
  >
    <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">Join Room</h2>
        <button class="text-gray-400 hover:text-white transition-colors" @click="emit('close')" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
        </button>
      </div>
      <div class="flex flex-col gap-4">
        <div>
          <label class="block text-sm text-gray-400 mb-1">Room ID or Share URL</label>
          <input
            v-model="joinInput"
            type="text"
            placeholder="abc123xyz012 or https://…/rooms/…"
            class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white outline-none"
            @keydown.enter="joinRoom"
          />
        </div>
        <button
          :disabled="!joinInput"
          class="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="joinRoom"
        >
          Join
        </button>
      </div>
    </div>
  </div>
</template>
