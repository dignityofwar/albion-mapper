<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '../stores/useRoomStore.js';
import { API_BASE_URL } from '../utils/api';

const props = defineProps<{ id: string }>();
const router = useRouter();
const store = useRoomStore();

const password = ref('');
const authError = ref('');
const authenticating = ref(false);

onMounted(() => {
  // If already authenticated (token in session storage), go straight to the room
  const stored = sessionStorage.getItem(`token:${props.id}`);
  if (stored) {
    store.setCredentials(props.id, stored);
    router.replace({ path: `/rooms/${props.id}` });
  }
});

async function authenticate() {
  if (!password.value) return;
  authenticating.value = true;
  authError.value = '';
  try {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${props.id}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value }),
    });
    if (!res.ok) {
      authError.value = 'Invalid password';
      return;
    }
    const { token } = await res.json() as { token: string };
    sessionStorage.setItem(`token:${props.id}`, token);
    store.setCredentials(props.id, token);
    router.push({ path: `/rooms/${props.id}` });
  } finally {
    authenticating.value = false;
  }
}
</script>

<template>
  <div class="h-screen flex items-center justify-center bg-gray-950 text-white p-6">
    <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
      <h2 class="text-xl font-semibold mb-4">Enter Room Password</h2>
      <p class="text-gray-400 text-sm mb-4">Room: <code class="text-indigo-300">{{ id }}</code></p>
      <input
        v-model="password"
        type="password"
        placeholder="Password"
        class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white outline-none mb-3"
        @keydown.enter="authenticate"
      />
      <p v-if="authError" class="text-red-400 text-sm mb-3">{{ authError }}</p>
      <button
        :disabled="!password || authenticating"
        class="w-full px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 font-medium disabled:opacity-50"
        @click="authenticate"
      >
        {{ authenticating ? 'Authenticating…' : 'Enter' }}
      </button>
      <hr class="my-4 border-gray-700" />
      <button
        class="w-full px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 font-medium"
        @click="router.push('/?create=true')"
      >
        Create a new Room
      </button>
    </div>
  </div>
</template>
