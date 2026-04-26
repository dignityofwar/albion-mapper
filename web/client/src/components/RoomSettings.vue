<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps<{
  roomId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const router = useRouter();
const show = ref(false);

function open() {
  show.value = true;
}

function close() {
  show.value = false;
  emit('close');
}

function logout() {
  sessionStorage.removeItem(`token:${props.roomId}`);
  router.replace({ path: `/rooms/${props.roomId}/auth` });
}

defineExpose({ open });
</script>

<template>
  <!-- Cog button -->
  <button
    class="fixed bottom-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 border border-gray-600 hover:bg-gray-700 text-lg shadow-lg"
    title="Settings"
    @click="open"
  >⚙️</button>

  <!-- Settings modal -->
  <Transition name="toast">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      @click.self="close"
    >
      <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-xl w-full max-w-sm flex flex-col">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 class="text-base font-semibold">⚙️ Settings</h2>
          <button class="text-gray-400 hover:text-white text-xl leading-none" @click="close">&times;</button>
        </div>
        <div class="p-4 space-y-3">
          <button
            class="w-full px-4 py-2 rounded bg-red-700 hover:bg-red-600 text-white text-sm font-medium flex items-center justify-center gap-2"
            @click="logout"
          >
            🚪 Log out
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
