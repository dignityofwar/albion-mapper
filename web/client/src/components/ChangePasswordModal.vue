<script setup lang="ts">
import { ref } from 'vue';
import { useRoomStore } from '../stores/useRoomStore';
import { API_BASE_URL } from '../utils/api';
import { track } from '@vercel/analytics';
import { Z_INDEX } from '@/constants/Layers';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const store = useRoomStore();

const newPassword = ref('');
const confirmPassword = ref('');
const adminPassword = ref('');
const passwordError = ref('');
const passwordSuccess = ref(false);
const savingPassword = ref(false);

function close() {
  emit('update:modelValue', false);
  // Reset state
  newPassword.value = '';
  confirmPassword.value = '';
  adminPassword.value = '';
  passwordError.value = '';
  passwordSuccess.value = false;
}

async function savePassword() {
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match';
    return;
  }
  if (!newPassword.value.trim()) {
    passwordError.value = 'Password cannot be empty';
    return;
  }
  if (!adminPassword.value.trim()) {
    passwordError.value = 'Admin password cannot be empty';
    return;
  }
  
  savingPassword.value = true;
  passwordError.value = '';
  passwordSuccess.value = false;
  try {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${store.roomId}/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${store.token}`,
      },
      body: JSON.stringify({ newPassword: newPassword.value, adminPassword: adminPassword.value }),
    });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      passwordError.value = body.error ?? 'Failed to change password';
      return;
    }
    passwordSuccess.value = true;
    track('change_password');
    newPassword.value = '';
    confirmPassword.value = '';
    adminPassword.value = '';
    setTimeout(() => {
      close();
    }, 1500);
  } finally {
    savingPassword.value = false;
  }
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
      <h2 class="text-xl font-semibold mb-4">Change Password</h2>
      <div class="flex flex-col gap-4">
        <div>
          <label class="block text-sm text-gray-400 mb-1">New Password</label>
          <input
            v-model="newPassword"
            type="password"
            placeholder="New password"
            class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white outline-none"
          />
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Confirm Password</label>
          <input
            v-model="confirmPassword"
            type="password"
            placeholder="Confirm password"
            class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white outline-none"
            @keydown.enter="savePassword"
          />
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Admin Password</label>
          <input
            v-model="adminPassword"
            type="password"
            placeholder="Admin password"
            class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white outline-none"
            @keydown.enter="savePassword"
          />
        </div>
        <p v-if="passwordError" class="text-red-400 text-sm">{{ passwordError }}</p>
        <p v-if="passwordSuccess" class="text-green-400 text-sm">Password updated!</p>
        <div class="flex gap-2">
          <button
            :disabled="savingPassword || !newPassword.trim()"
            class="flex-1 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            @click="savePassword"
          >
            {{ savingPassword ? 'Saving…' : 'Save' }}
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
