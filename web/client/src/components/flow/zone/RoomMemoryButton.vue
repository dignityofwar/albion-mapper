<script setup lang="ts">
import { ref, computed } from 'vue';
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

const props = defineProps<{
  entry: RoomMemoryEntry | null;
  zoneName: string;
}>();

const dialogOpen = ref(false);

const hasHistory = computed(() => !!props.entry && props.entry.timesAdded.length > 1);

const lastSeen = computed(() => {
  const arr = props.entry?.timesAdded;
  if (!arr || arr.length === 0) return null;
  return arr[arr.length - 1];
});

const timesSeen = computed(() => props.entry?.timesAdded.length ?? 0);

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <DialogRoot v-model:open="dialogOpen">
      <TooltipRoot>
        <TooltipTrigger asChild>
          <button
            class="room-memory-btn"
            :class="{ 'room-memory-btn--disabled': !hasHistory }"
            :disabled="!hasHistory"
            @click.stop="hasHistory && (dialogOpen = true)"
            aria-label="Room memory"
          >
            ⏳
          </button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent class="bg-black text-white text-xs px-2 py-1 rounded shadow-lg z-[10000] text-center">
            <template v-if="hasHistory">
              <div v-if="lastSeen">Last added: <b>{{ formatDate(lastSeen) }}</b></div>
              <div>Times seen: <b>{{ timesSeen }}</b></div>
            </template>
            <template v-else>
              <div>First sighting of this zone.<br>Future additions will show a history of sightings, <br> and retain Map Features and portal settings applied to them.</div>
            </template>
          </TooltipContent>
        </TooltipPortal>
      </TooltipRoot>

      <DialogPortal>
        <DialogOverlay class="fixed inset-0 bg-black/60 z-[9998]" />
        <DialogContent class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-[9999] p-6 w-80 max-w-full">
          <DialogTitle class="text-white font-semibold text-base mb-1">
            ⏳ {{ zoneName }}
          </DialogTitle>
          <p class="text-gray-400 text-xs mb-4">Times seen: {{ timesSeen }}</p>
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
          <DialogClose class="mt-4 w-full text-center text-xs text-gray-500 hover:text-gray-300 cursor-pointer">
            Close
          </DialogClose>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </TooltipProvider>
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
</style>
