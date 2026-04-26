<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoomStore } from '../stores/useRoomStore.js';

const store = useRoomStore();

const open = ref(false);
const popupEl = ref<HTMLDivElement | null>(null);

// Change password state
const showPasswordForm = ref(false);
const newPassword = ref('');
const passwordError = ref('');
const passwordSuccess = ref(false);
const savingPassword = ref(false);

// Reset state
const resetting = ref(false);
const resetError = ref('');

// Copy link state
const copied = ref(false);

function toggleOpen() {
  open.value = !open.value;
  if (!open.value) resetSubForms();
}

function resetSubForms() {
  showPasswordForm.value = false;
  newPassword.value = '';
  passwordError.value = '';
  passwordSuccess.value = false;
  resetError.value = '';
  copied.value = false;
}

function onClickOutside(e: MouseEvent) {
  if (open.value && popupEl.value && !popupEl.value.contains(e.target as Node)) {
    open.value = false;
    resetSubForms();
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside));
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside));

async function reset() {
  resetting.value = true;
  resetError.value = '';
  try {
    const res = await fetch(`/api/rooms/${store.roomId}/connections`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${store.token}` },
    });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      resetError.value = body.error ?? 'Reset failed';
      return;
    }
    open.value = false;
    resetSubForms();
  } finally {
    resetting.value = false;
  }
}

async function savePassword() {
  if (!newPassword.value.trim()) return;
  savingPassword.value = true;
  passwordError.value = '';
  passwordSuccess.value = false;
  try {
    const res = await fetch(`/api/rooms/${store.roomId}/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${store.token}`,
      },
      body: JSON.stringify({ newPassword: newPassword.value }),
    });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      passwordError.value = body.error ?? 'Failed to change password';
      return;
    }
    passwordSuccess.value = true;
    newPassword.value = '';
    setTimeout(() => {
      passwordSuccess.value = false;
      showPasswordForm.value = false;
    }, 1500);
  } finally {
    savingPassword.value = false;
  }
}

function copyLink() {
  const url = `${window.location.origin}/rooms/${store.roomId}`;
  navigator.clipboard.writeText(url).then(() => {
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  });
}
</script>

<template>
  <div ref="popupEl" class="relative shrink-0" style="z-index:200">
    <!-- Cog button -->
    <button
      type="button"
      class="flex items-center justify-center w-9 h-9 rounded bg-indigo-700 border border-indigo-500 text-white hover:bg-indigo-600 transition-colors"
      title="Room settings"
      data-testid="settings-cog"
      @click="toggleOpen"
    >
      <!-- gear icon (SVG) -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
        <path fill-rule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clip-rule="evenodd" />
      </svg>
    </button>

    <!-- Popup -->
    <div
      v-if="open"
      class="absolute left-0 top-full mt-1 w-56 bg-gray-900 border border-gray-600 rounded shadow-xl" style="z-index:9999"
      data-testid="settings-popup"
    >
      <!-- Reset -->
      <div class="border-b border-gray-700 p-2">
        <p v-if="resetError" class="text-red-400 text-xs mb-1">{{ resetError }}</p>
        <button
          type="button"
          :disabled="resetting"
          class="w-full text-left px-3 py-2 text-sm rounded text-red-400 hover:bg-gray-700 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="settings-reset"
          @click="reset"
        >
          {{ resetting ? 'Resetting…' : '⟳  Reset all connections' }}
        </button>
      </div>

      <!-- Change password -->
      <div class="border-b border-gray-700 p-2">
        <button
          v-if="!showPasswordForm"
          type="button"
          class="w-full text-left px-3 py-2 text-sm rounded text-gray-200 hover:bg-gray-700"
          data-testid="settings-change-password-toggle"
          @click="showPasswordForm = true"
        >
          🔒  Change password
        </button>
        <div v-else class="flex flex-col gap-1">
          <input
            v-model="newPassword"
            type="password"
            placeholder="New password"
            class="bg-gray-800 border border-gray-600 text-white text-sm rounded px-2 py-1 outline-none w-full"
            data-testid="settings-new-password"
            @keydown.enter="savePassword"
            @keydown.esc="showPasswordForm = false"
          />
          <p v-if="passwordError" class="text-red-400 text-xs">{{ passwordError }}</p>
          <p v-if="passwordSuccess" class="text-green-400 text-xs">Password updated!</p>
          <div class="flex gap-1">
            <button
              type="button"
              :disabled="savingPassword || !newPassword.trim()"
              class="flex-1 text-sm px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="settings-save-password"
              @click="savePassword"
            >
              {{ savingPassword ? 'Saving…' : 'Save' }}
            </button>
            <button
              type="button"
              class="flex-1 text-sm px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
              @click="showPasswordForm = false"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Copy link -->
      <div class="p-2">
        <button
          type="button"
          class="w-full text-left px-3 py-2 text-sm rounded text-gray-200 hover:bg-gray-700"
          data-testid="settings-copy-link"
          @click="copyLink"
        >
          {{ copied ? '✓  Copied!' : '🔗  Copy room link' }}
        </button>
      </div>
    </div>
  </div>
</template>
