<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent, TooltipPortal } from 'reka-ui';
import ZoneCombobox from './ZoneCombobox.vue';
import RoomSettings from './RoomSettings.vue';
import TimeInput from './common/TimeInput.vue';
import { useRoomStore } from '../stores/useRoomStore.js';
import { ZONE_BY_ID } from 'shared';
import { API_BASE_URL } from '../utils/api';

const store = useRoomStore();

const fromZoneId = ref('');
const isLocked = computed(() => store.connections.length === 0);

const connectedToFromZone = computed(() => {
  return store.connections
    .filter(c => c.fromZoneId === fromZoneId.value)
    .map(c => c.toZoneId);
});

watch([() => store.homeZoneId, isLocked], ([newHomeId, locked]) => {
  if (locked && newHomeId) {
    fromZoneId.value = newHomeId;
  }
}, { immediate: true });

const toZoneId = ref('');
const minutesRemaining = ref<number | null>(null);
watch([fromZoneId, toZoneId], () => {
  minutesRemaining.value = null;
});
const reportedBy = ref('');
const submitting = ref(false);

function getZoneName(id: string) {
  return ZONE_BY_ID.get(id)?.name ?? id;
}

const emit = defineEmits<{
  success: [message: string];
  error: [message: string];
}>();

// ...

const canSubmit = computed(
  () => fromZoneId.value && toZoneId.value && minutesRemaining.value !== null && !submitting.value,
);

async function submit() {
  if (!canSubmit.value) return;
  submitting.value = true;

  try {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${store.roomId}/connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${store.token}`,
      },
      body: JSON.stringify({
        fromZoneId: fromZoneId.value,
        toZoneId: toZoneId.value,
        minutesRemaining: Number(minutesRemaining.value!),
        reportedBy: reportedBy.value || undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.json() as { error?: string };
      emit('error', body.error ?? 'Failed to submit');
      return;
    }

    emit('success', 'Connection added!');

    // To becomes the new From, reset time
    toZoneId.value = '';
    minutesRemaining.value = null;
  } finally {
    submitting.value = false;
  }
}

function onTimeKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') submit();
}

const timeInputEl = ref<{ focus: () => void } | null>(null);
const toComboboxInputEl = ref<{ focus: () => void; flash: () => void } | null>(null);
const fromComboboxInputEl = ref<{ focus: () => void } | null>(null);

function focusToCombobox() {
  toComboboxInputEl.value?.focus();
}

function flashToCombobox() {
  toComboboxInputEl.value?.flash();
}

function focusTimeInput() {
  timeInputEl.value?.focus();
}

defineExpose({ minutesRemaining, fromZoneId, setFromZoneId: (id: string) => fromZoneId.value = id, focusToCombobox, flashToCombobox });
</script>

<template>
  <form
    class="relative flex flex-col md:flex-row md:items-center gap-2 p-2.5 bg-gray-900 border-b border-gray-700"
    style="z-index:10"
    data-testid="report-form"
    @submit.prevent="submit"
  >
    <!-- Settings cog -->
    <RoomSettings class="hidden md:block" />

    <!-- From -->
    <div class="flex-1 min-w-0">
      <template v-if="isLocked">
        <TooltipProvider :delay-duration="0">
          <TooltipRoot>
            <TooltipTrigger asChild>
              <ZoneCombobox
                ref="fromComboboxInputEl"
                v-model="fromZoneId"
                placeholder="From zone…"
                data-testid="from-combobox"
                :smart-already-added="true"
                already-added-placement="top"
                :error="minutesRemaining !== null && !fromZoneId"
                :disabled="true"
                icon="🏠"
                @tab-select="focusToCombobox"
                @select="focusToCombobox"
              />
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent class="bg-black text-white text-xs px-2 py-1 rounded shadow-lg z-50">
                Locked until more zones added
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>
        </TooltipProvider>
      </template>
      <ZoneCombobox
        v-else
        ref="fromComboboxInputEl"
        v-model="fromZoneId"
        placeholder="From zone…"
        data-testid="from-combobox"
        :smart-already-added="true"
        already-added-placement="top"
        :error="minutesRemaining !== null && !fromZoneId"
        @tab-select="focusToCombobox"
        @select="focusToCombobox"
      />
    </div>

    <!-- To -->
    <div class="flex-1 min-w-0">
      <ZoneCombobox
        ref="toComboboxInputEl"
        v-model="toZoneId"
        placeholder="To zone…"
        :excluded-ids="[fromZoneId, ...connectedToFromZone]"
        :smart-already-added="true"
        already-added-placement="bottom"
        data-testid="to-combobox"
        :error="minutesRemaining !== null && !toZoneId"
        @tab-select="focusTimeInput"
        @select="focusTimeInput"
      />
    </div>

    <!-- Time -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-gray-400 text-sm whitespace-nowrap">Expires:</label>
      <TimeInput
        ref="timeInputEl"
        v-model="minutesRemaining"
        data-testid="time-input"
        @keydown="onTimeKeydown"
      />
      <!-- Submit -->
      <button
        type="submit"
        :disabled="!canSubmit"
        class="ml-1 px-4 py-3 md:py-2.5 rounded border border-transparent bg-indigo-600 text-white text-sm font-medium leading-none hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex-1 md:flex-none"
        data-testid="submit-button"
      >
        Add
      </button>
    </div>

    <!-- Error -->
  </form>
</template>
