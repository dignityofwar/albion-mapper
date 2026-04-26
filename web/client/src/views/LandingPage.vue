<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import ZoneCombobox from '../components/ZoneCombobox.vue';
import { useRoomStore } from '../stores/useRoomStore';

const router = useRouter();
const route = useRoute();
const store = useRoomStore();

// ── Create Room modal ────────────────────────────────────────────────────────
const showCreate = ref(false);
const createPassword = ref('');
const createAdminPassword = ref('');
const createHomeZoneId = ref('');
const createFormKey = ref(0);
const creating = ref(false);
const createError = ref('');

function openCreateRoom() {
  store.disconnect();
  showCreate.value = true;
  resetCreateForm();
}

function resetCreateForm() {
  createPassword.value = '';
  createAdminPassword.value = '';
  createHomeZoneId.value = '';
  createError.value = '';
  createFormKey.value++;
}

watch(() => route.query.create, (val) => {
  if (val === 'true') {
    openCreateRoom();
  }
});

onMounted(() => {
  if (route.query.create === 'true') {
    openCreateRoom();
  }
});

async function createRoom() {
  if (!createPassword.value || !createAdminPassword.value || !createHomeZoneId.value) return;
  creating.value = true;
  createError.value = '';
  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: createPassword.value,
        adminPassword: createAdminPassword.value,
        homeZoneId: createHomeZoneId.value
      }),
    });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      createError.value = body.error ?? 'Failed to create room';
      return;
    }
    const { id } = await res.json() as { id: string };

    // Authenticate immediately
    const authRes = await fetch(`/api/rooms/${id}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: createPassword.value }),
    });
    const { token } = await authRes.json() as { token: string };

    sessionStorage.setItem(`token:${id}`, token);
    sessionStorage.setItem(`shareUrl:${id}`, `${window.location.origin}/rooms/${id}`);
    resetCreateForm();
    await router.push(`/rooms/${id}`);
  } finally {
    creating.value = false;
  }
}

// ── Join Room modal ──────────────────────────────────────────────────────────
const showJoin = ref(false);
const joinInput = ref('');

function resetJoinForm() {
  joinInput.value = '';
}

function joinRoom() {
  const value = joinInput.value.trim();
  if (!value) return;
  // Accept full URL or bare id
  const match = value.match(/rooms\/([^/?#]+)/);
  const id = match ? match[1] : value;
  router.push(`/rooms/${id}`);
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-8 p-6">
    <h1 class="text-4xl font-bold text-indigo-400">Albion Roads Mapper</h1>
    <p class="text-gray-400 text-center max-w-md">
      Collaborate with your guild in real-time to track Roads of Avalon portal connections.
    </p>

    <div class="flex gap-4">
      <button
        class="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium transition-colors"
        @click="openCreateRoom()"
      >
        Create Room
      </button>
      <button
        class="px-6 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 font-medium transition-colors"
        @click="showJoin = true; resetJoinForm()"
      >
        Join Room
      </button>
    </div>

    <!-- Create Room Modal -->
    <div
      v-if="showCreate"
      class="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
    >
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
        <h2 class="text-xl font-semibold mb-4">Create Room</h2>
        <div class="flex flex-col gap-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1">Password</label>
            <input
              v-model="createPassword"
              type="password"
              placeholder="Choose a password"
              class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white outline-none"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Admin Password</label>
            <input
              v-model="createAdminPassword"
              type="password"
              placeholder="Choose an admin password"
              class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white outline-none"
            />
            <p class="text-xs text-yellow-600 mt-1">If you lose this password, you cannot change the room's password or wipe connections!</p>
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Home Zone</label>
            <ZoneCombobox :key="createFormKey" v-model="createHomeZoneId" placeholder="Search home zone…" />
          </div>
          <p v-if="createError" class="text-red-400 text-sm">{{ createError }}</p>
          <button
            :disabled="!createPassword || !createAdminPassword || !createHomeZoneId || creating"
            class="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            @click="createRoom"
          >
            {{ creating ? 'Creating…' : 'Create' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Join Room Modal -->
    <div
      v-if="showJoin"
      class="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
      @click.self="showJoin = false"
    >
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
        <h2 class="text-xl font-semibold mb-4">Join Room</h2>
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
  </div>
</template>
