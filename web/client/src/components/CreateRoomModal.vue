<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import ZoneCombobox from './ZoneCombobox.vue';
import { useRoomStore } from '../stores/useRoomStore';
import { useTutorialStore } from '../stores/useTutorialStore';
import { API_BASE_URL } from '../utils/api';
import { track } from '@vercel/analytics';
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';

const emit = defineEmits<{ close: [] }>();

const router = useRouter();
const store = useRoomStore();
const tutorialStore = useTutorialStore();

const createPassword = ref('');
const createAdminPassword = ref('');
const createHomeZoneId = ref('');
const createTitle = ref('');
const createVanityUrl = ref('');
const vanityUrlStatus = ref<'checking' | 'available' | 'taken' | 'idle'>('idle');
let vanityDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let vanityUrlFromTitle = false;
const showTutorial = ref(!tutorialStore.completed);
const createFormKey = ref(0);
const creating = ref(false);
const createError = ref('');

watch(showTutorial, (val) => {
  if (!val) {
    tutorialStore.setCompleted(true);
  }
});

async function checkSlugAvailability(s: string) {
  if (!s) { vanityUrlStatus.value = 'idle'; return; }
  vanityUrlStatus.value = 'checking';
  try {
    const res = await fetch(`${API_BASE_URL}/api/slugs/check/${encodeURIComponent(s)}`);
    if (!res.ok) { vanityUrlStatus.value = 'idle'; return; }
    const { available } = await res.json() as { available: boolean };
    vanityUrlStatus.value = available ? 'available' : 'taken';
  } catch {
    vanityUrlStatus.value = 'idle';
  }
}

function scheduleSlugCheck(s: string) {
  if (vanityDebounceTimer) clearTimeout(vanityDebounceTimer);
  if (!s) { vanityUrlStatus.value = 'idle'; return; }
  vanityUrlStatus.value = 'checking';
  vanityDebounceTimer = setTimeout(() => checkSlugAvailability(s), 250);
}

watch(createTitle, (val) => {
  const generated = val
    ? val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    : uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals], separator: '-', length: 3 });
  vanityUrlFromTitle = true;
  createVanityUrl.value = generated;
  vanityUrlFromTitle = false;
  scheduleSlugCheck(generated);
});

watch(createVanityUrl, (val) => {
  if (vanityUrlFromTitle) return;
  scheduleSlugCheck(val);
});

function resetForm() {
  createPassword.value = '';
  createAdminPassword.value = '';
  createHomeZoneId.value = '';
  createTitle.value = '';
  createVanityUrl.value = '';
  vanityUrlStatus.value = 'idle';
  if (vanityDebounceTimer) { clearTimeout(vanityDebounceTimer); vanityDebounceTimer = null; }
  createError.value = '';
  createFormKey.value++;
}

function init() {
  store.disconnect();
  resetForm();
  const initial = uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals], separator: '-', length: 3 });
  vanityUrlFromTitle = true;
  createVanityUrl.value = initial;
  vanityUrlFromTitle = false;
  checkSlugAvailability(initial);
}

// Initialize on mount
init();

async function createRoom() {
  if (!createPassword.value || !createAdminPassword.value || !createHomeZoneId.value) return;
  creating.value = true;
  createError.value = '';
  try {
    const res = await fetch(`${API_BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: createPassword.value,
        adminPassword: createAdminPassword.value,
        homeZoneId: createHomeZoneId.value,
        title: createTitle.value,
        vanityUrl: createVanityUrl.value,
      }),
    });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      createError.value = body.error ?? 'Failed to create room';
      return;
    }
    const { id } = await res.json() as { id: string };

    // Authenticate immediately
    const authRes = await fetch(`${API_BASE_URL}/api/rooms/${id}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: createPassword.value }),
    });
    const { token } = await authRes.json() as { token: string };

    sessionStorage.setItem(`token:${id}`, token);
    sessionStorage.setItem(`shareUrl:${id}`, `${window.location.origin}/rooms/${id}`);

    if (showTutorial.value) {
      tutorialStore.setCompleted(false);
      tutorialStore.setStep(0);
    }

    track('create_room');
    resetForm();
    emit('close');
    await router.push(`/rooms/${id}`);
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <div
    class="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
  >
    <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">Create Room</h2>
        <button class="text-gray-400 hover:text-white transition-colors" @click="emit('close')" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
        </button>
      </div>
      <div class="flex flex-col gap-4">
        <div>
          <label class="block text-sm text-gray-400 mb-1">Title (Optional)</label>
          <input
            v-model="createTitle"
            type="text"
            placeholder="e.g. My Guild Room"
            maxlength="50"
            class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white outline-none"
          />
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Vanity URL (Optional)</label>
          <input
            v-model="createVanityUrl"
            type="text"
            placeholder="e.g. my-guild-room"
            maxlength="100"
            class="w-full bg-gray-800 border border-gray-600 px-3 py-2 text-white outline-none"
            :class="vanityUrlStatus === 'idle' ? 'rounded' : 'rounded-t'"
          />
          <div
            v-if="vanityUrlStatus !== 'idle'"
            class="px-3 py-1.5 text-sm font-medium rounded-b flex items-center gap-2"
            :class="{
              'bg-gray-700 text-gray-300': vanityUrlStatus === 'checking',
              'bg-green-900/60 text-green-300': vanityUrlStatus === 'available',
              'bg-red-900/60 text-red-300': vanityUrlStatus === 'taken',
            }"
          >
            <span v-if="vanityUrlStatus === 'checking'">⏳ Checking…</span>
            <span v-else-if="vanityUrlStatus === 'available'">✅ Link available</span>
            <span v-else-if="vanityUrlStatus === 'taken'">❌ Already taken</span>
          </div>
        </div>
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
          <p class="text-xs text-yellow-600 mt-1">Keep this safe, otherwise you cannot change the room's password!</p>
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Home Zone</label>
          <ZoneCombobox :key="createFormKey" v-model="createHomeZoneId" placeholder="Search home zone…" only-roads-hideout />
        </div>
        <div class="flex items-center gap-2">
          <input type="checkbox" v-model="showTutorial" id="showTutorial" />
          <label for="showTutorial" class="text-sm text-gray-300">Show Tutorial</label>
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
</template>
