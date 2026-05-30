<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
  TooltipPortal,
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose,
} from 'reka-ui';
import type { RoomMemoryEntry } from 'shared';
import { useRoomStore } from '@/stores/useRoomStore';
import { API_BASE_URL } from '@/utils/api';

const props = defineProps<{
  entry: RoomMemoryEntry | null;
  zoneName: string;
  zoneId: string;
  hasRotationError?: boolean;
}>();

const dialogOpen = ref(false);
const deleteResetConfirmOpen = ref(false);
const roomStore = useRoomStore();
const showToast = inject<(msg: string, type?: 'info' | 'error') => void>('showToast');

const hasHistory = computed(() => !!props.entry && props.entry.timesAdded.length > 1);
const isEnabled = computed(() => hasHistory.value || props.hasRotationError);

const lastSeen = computed(() => {
  const arr = props.entry?.timesAdded;
  if (!arr || arr.length < 2) return null;
  return arr[arr.length - 2];
});

const timesSeen = computed(() => props.entry?.timesAdded.length ?? 0);

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

async function deleteHistoryAndReset() {
  await fetch(`${API_BASE_URL}/api/rooms/${roomStore.roomId}/memory/${encodeURIComponent(props.zoneId)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${roomStore.token}` },
  });
  roomStore.resetZonePortals(props.zoneId);
  roomStore.clearRotationError(props.zoneId);
  deleteResetConfirmOpen.value = false;
  dialogOpen.value = false;
  showToast?.('Zone history deleted and portals reset.');
}
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <DialogRoot v-model:open="dialogOpen">
      <TooltipRoot>
        <TooltipTrigger asChild>
          <button
            class="room-memory-btn"
            :class="{ 'room-memory-btn--disabled': !isEnabled, 'room-memory-btn--error': hasRotationError }"
            :disabled="!isEnabled"
            @click.stop="isEnabled && (dialogOpen = true)"
            aria-label="Room memory"
          >
            ⏳
          </button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent class="bg-black text-white text-xs px-2 py-1 rounded shadow-lg z-[10000] text-center">
            <template v-if="hasRotationError">
              <div class="text-red-400 font-bold">⚠ Rotation mismatch detected!</div>
              <div>Click to open and use "Delete history &amp; Reset"<br>to fix the portal layout for this zone.</div>
            </template>
            <template v-else-if="hasHistory">
              <div v-if="lastSeen">Last seen: <b>{{ formatDate(lastSeen) }}</b></div>
              <div>Times seen: <b>{{ timesSeen }}</b></div>
            </template>
            <template v-else>
              <div>First sighting of this zone.<br>Map Features and portal layouts will be saved,<br> and applied automatically in the future.</div>
            </template>
          </TooltipContent>
        </TooltipPortal>
      </TooltipRoot>

      <DialogPortal>
        <DialogOverlay class="fixed inset-0 bg-black/60 z-[9998]" />
        <DialogContent class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-[9999] p-6 w-[440px] max-w-[90vw] flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <DialogTitle class="text-white font-bold text-lg">
              ⏳ {{ zoneName }}
            </DialogTitle>
            <DialogClose class="text-gray-400 hover:text-white py-2 px-2 zone-button transition-colors text-xl leading-none cursor-pointer flex items-center gap-1.5" aria-label="Close">
              <span class="text-[10px] uppercase text-white font-bold tracking-widest">Close</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </DialogClose>
          </div>
          <p class="text-gray-400 text-xs -mt-2">Times seen: {{ timesSeen }}</p>
          <ul class="space-y-1 max-h-64 overflow-y-auto">
            <li
              v-for="(date, idx) in [...(entry?.timesAdded ?? [])].reverse()"
              :key="idx"
              class="text-sm text-gray-200 flex items-center gap-2"
            >
              <span class="text-gray-500 text-xs w-5 text-right">{{ timesSeen - idx }}.</span>
              {{ formatDate(date) }}
            </li>
          </ul>
          <div class="flex justify-end mt-2">
            <button
              @click="deleteResetConfirmOpen = true"
              class="px-4 py-2 rounded font-semibold text-sm bg-red-700 hover:bg-red-600 text-white transition-colors"
            >Delete history &amp; Reset</button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </TooltipProvider>

  <!-- Delete & Reset Confirmation Dialog -->
  <DialogRoot v-model:open="deleteResetConfirmOpen">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 bg-black/70 z-[10000]" />
      <DialogContent class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-[10001] p-6 w-[440px] max-w-[90vw] flex flex-col gap-4">
        <DialogTitle class="text-white font-bold text-lg">Are you sure?</DialogTitle>
        <p class="text-gray-300 text-sm leading-relaxed">
          This will delete the history for <strong class="text-white">{{ zoneName }}</strong> and reset its portal locations and rotations back to default.
        </p>
        <p class="text-gray-300 text-sm leading-relaxed">
          Current connections will remain the same.
        </p>
        <p class="text-white text-sm leading-relaxed font-bold">
          Are you really sure you want to do this?
        </p>
        <div class="flex justify-end gap-3 mt-2">
          <button
            @click="deleteResetConfirmOpen = false"
            class="px-4 py-2 rounded font-semibold text-sm bg-indigo-700 hover:bg-blue-600 text-white transition-colors"
          >No</button>
          <button
            @click="deleteHistoryAndReset"
            class="px-4 py-2 rounded font-semibold text-sm bg-red-700 hover:bg-red-600 text-white transition-colors"
          >Yes</button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.room-memory-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(30, 30, 40, 0.85);
  border: 1px solid rgba(200, 180, 80, 0.5);
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  transition: background 0.15s, border-color 0.15s;
  padding: 0;
}
.room-memory-btn:hover:not(:disabled) {
  background: rgba(60, 55, 20, 0.95);
  border-color: rgba(255, 220, 80, 0.8);
}
.room-memory-btn--disabled {
  opacity: 0.4;
  cursor: default;
}
.room-memory-btn--error {
  background: rgba(180, 30, 30, 0.85);
  border-color: rgba(255, 80, 80, 0.8);
}
.room-memory-btn--error:hover {
  background: rgba(220, 50, 50, 0.95);
  border-color: rgba(255, 120, 120, 0.9);
}
</style>
