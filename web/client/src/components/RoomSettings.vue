<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '@/stores/useRoomStore';
import { useTutorialStore } from '@/stores/useTutorialStore';
import { API_BASE_URL } from '@/utils/api';
import { track } from '@vercel/analytics';
import ChangePasswordModal from './ChangePasswordModal.vue';
import ResetConfirmModal from './ResetConfirmModal.vue';
import TutorialTooltip from './tutorial/TutorialTooltip.vue';

const props = defineProps<{
  tray?: boolean;
}>();

const store = useRoomStore();
const tutorialStore = useTutorialStore();
const router = useRouter();
const cogRef = ref<HTMLElement | null>(null);

const open = ref(false);
const popupEl = ref<HTMLDivElement | null>(null);

// Change password state
const showChangePasswordModal = ref(false);
const showResetConfirmModal = ref(false);

// Reset state
const resetting = ref(false);
const resetError = ref('');

// Copy link state
const copied = ref(false);

function toggleOpen() {
  open.value = !open.value;
  if (!open.value) resetSubForms();
  if (!tutorialStore.completed && tutorialStore.step === 16) {
    tutorialStore.setStep(17);
    tutorialStore.setCompleted(true);
  }
}

function resetSubForms() {
  showChangePasswordModal.value = false;
  showResetConfirmModal.value = false;
  resetError.value = '';
  copied.value = false;
}

function onClickOutside(e: MouseEvent) {
  if (open.value && popupEl.value && !popupEl.value.contains(e.target as Node)) {
    open.value = false;
    resetSubForms();
  }
}

onMounted(() => document.addEventListener('click', onClickOutside));
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside));

async function reset(adminPassword: string) {
  resetting.value = true;
  resetError.value = '';
  try {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${store.roomId}/connections`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${store.token}`,
      },
      body: JSON.stringify({ adminPassword }),
    });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      resetError.value = body.error ?? 'Reset failed';
      return;
    }
    open.value = false;
    resetSubForms();
    track('reset_all_connections');
  } finally {
    resetting.value = false;
  }
}

// savePassword function removed from here, it's now in ChangePasswordModal.vue

function copyLink() {
  const url = `${window.location.origin}/rooms/${store.roomId}`;
  navigator.clipboard.writeText(url).then(() => {
    copied.value = true;
    track('copy_room_link');
    setTimeout(() => { copied.value = false; }, 2000);
  });
}

function logout() {
  sessionStorage.removeItem(`token:${store.roomId}`);
  store.disconnect();
  track('logout');
  router.replace({ path: '/' });
}
</script>

<template>
  <div class="contents">
    <div ref="popupEl" class="relative shrink-0" style="z-index:200">
      <!-- Cog button -->
      <button
        ref="cogRef"
        type="button"
        :class="[
          tray
            ? 'w-12 h-12 flex items-center justify-center rounded-full bg-gray-800 border border-gray-600 hover:bg-gray-700 text-xl shadow-lg transition-colors'
            : 'flex items-center justify-center px-3 py-2 rounded bg-indigo-700 border border-indigo-500 text-white text-sm leading-none hover:bg-indigo-600 transition-colors'
        ]"
        title="Room settings"
        data-testid="settings-cog"
        @click="toggleOpen"
      >
        <span v-if="tray">⚙️</span>
        <!-- gear icon (SVG) -->
        <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
          <path fill-rule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clip-rule="evenodd" />
        </svg>
      </button>

      <TutorialTooltip
        v-if="!tutorialStore.completed && tutorialStore.step === 16"
        message="You can copy links and change the room password here"
        pointing="up"
        :target="cogRef ?? undefined"
      />

      <!-- Popup -->
      <div
        v-if="open"
        :class="[
          'absolute w-56 bg-gray-900 border border-gray-600 rounded shadow-xl',
          tray ? 'right-0 bottom-full mb-2' : 'left-0 top-full mt-1'
        ]"
        style="z-index:9999"
        data-testid="settings-popup"
      >
        <!-- Change password -->
        <div class="border-b border-gray-700 p-2">
          <button
            type="button"
            class="w-full text-left px-3 py-2 text-sm rounded text-gray-200 hover:bg-gray-700"
            data-testid="settings-change-password-toggle"
            @click="showChangePasswordModal = true"
          >
            🔒  Change password
          </button>
        </div>

        <!-- Copy link -->
        <div class="border-b border-gray-700 p-2">
          <button
            type="button"
            class="w-full text-left px-3 py-2 text-sm rounded text-gray-200 hover:bg-gray-700"
            data-testid="settings-copy-link"
            @click="copyLink"
          >
            {{ copied ? '✓  Copied!' : '🔗  Copy room link' }}
          </button>
        </div>

        <!-- Logout -->
        <div class="p-2">
          <button
            type="button"
            class="w-full text-left px-3 py-2 text-sm rounded text-red-400 hover:bg-gray-700 hover:text-red-300"
            @click="logout"
          >
            🚪 Log out
          </button>
        </div>
      </div>
    </div>
    <ChangePasswordModal v-model="showChangePasswordModal" />
  </div>
</template>
