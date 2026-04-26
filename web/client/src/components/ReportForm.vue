<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent, TooltipPortal } from 'reka-ui';
import ZoneCombobox from './ZoneCombobox.vue';
import SettingsPopup from './SettingsPopup.vue';
import TimeInput from './common/TimeInput.vue';
import { useRoomStore } from '../stores/useRoomStore.js';
import { ZONE_BY_ID } from 'shared';

const store = useRoomStore();

const fromZoneId = ref('');
const isLocked = computed(() => store.connections.length === 0);

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
    const res = await fetch(`/api/rooms/${store.roomId}/connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${store.token}`,
      },
      body: JSON.stringify({
        fromZoneId: fromZoneId.value,
        toZoneId: toZoneId.value,
        minutesRemaining: minutesRemaining.value!,
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
const toComboboxInputEl = ref<{ $el: HTMLElement } | null>(null);
const fromComboboxInputEl = ref<{ $el: HTMLElement } | null>(null);

function focusToCombobox() {
  toComboboxInputEl.value?.$el?.querySelector('input')?.focus();
}

function focusTimeInput() {
  timeInputEl.value?.focus();
}

defineExpose({ minutesRemaining, fromZoneId });
</script>

<template>
  <form
    class="relative flex flex-col md:flex-row md:items-center gap-2 p-2 bg-gray-900 border-b border-gray-700"
    style="z-index:10"
    data-testid="report-form"
    @submit.prevent="submit"
  >
    <!-- Settings cog -->
    <SettingsPopup />

    <!-- From -->
    <div class="flex-1 min-w-0">
      <TooltipProvider v-if="isLocked" :delay-duration="0">
        <TooltipRoot>
          <TooltipTrigger asChild>
            <div class="border rounded bg-gray-800 border-gray-700 px-3 py-2 text-sm text-gray-500 cursor-not-allowed truncate">
              🏠 {{ getZoneName(fromZoneId) }}
            </div>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent class="bg-black text-white text-xs px-2 py-1 rounded shadow-lg z-50">
              Locked until more zones added
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
      </TooltipProvider>
      <ZoneCombobox
        v-else
        ref="fromComboboxInputEl"
        v-model="fromZoneId"
        placeholder="From zone…"
        data-testid="from-combobox"
        :error="minutesRemaining !== null && !fromZoneId"
        @tab-select="focusToCombobox"
      />
    </div>

    <!-- To -->
    <div class="flex-1 min-w-0">
      <ZoneCombobox
        ref="toComboboxInputEl"
        v-model="toZoneId"
        placeholder="To zone…"
        :exclude-id="fromZoneId"
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
    </div>

    <!-- Submit -->
    <button
      type="submit"
      :disabled="!canSubmit"
      class="px-4 py-2 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
      data-testid="submit-button"
    >
      Add
    </button>

    <!-- Error -->
  </form>
</template>
