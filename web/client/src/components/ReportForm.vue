<script setup lang="ts">
import { ref, computed } from 'vue';
import ZoneCombobox from './ZoneCombobox.vue';
import SettingsPopup from './SettingsPopup.vue';
import { useRoomStore } from '../stores/useRoomStore.js';

const store = useRoomStore();

const fromZoneId = ref('');
const toZoneId = ref('');
const timeInput = ref('');
const reportedBy = ref('');
const submitting = ref(false);
const error = ref('');

const emit = defineEmits<{
  success: [message: string];
}>();

/** Parse "H:MM" or plain minutes like "90" → total minutes, or null if invalid */
function parseTime(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx !== -1) {
    const hours = parseInt(trimmed.slice(0, colonIdx), 10);
    const mins = parseInt(trimmed.slice(colonIdx + 1), 10);
    if (isNaN(hours) || isNaN(mins) || mins < 0 || mins > 59) return null;
    const total = hours * 60 + mins;
    return total >= 1 && total <= 360 ? total : null;
  }
  const mins = parseInt(trimmed, 10);
  if (isNaN(mins)) return null;
  return mins >= 1 && mins <= 360 ? mins : null;
}

const minutesRemaining = computed(() => parseTime(timeInput.value));

const canSubmit = computed(
  () => fromZoneId.value && toZoneId.value && minutesRemaining.value !== null && !submitting.value,
);

async function submit() {
  if (!canSubmit.value) return;
  submitting.value = true;
  error.value = '';

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
      error.value = body.error ?? 'Failed to submit';
      return;
    }

    emit('success', 'Connection reported!');

    // To becomes the new From, reset time
    fromZoneId.value = toZoneId.value;
    toZoneId.value = '';
    timeInput.value = '';
  } finally {
    submitting.value = false;
  }
}

function onTimeKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') submit();
}

const timeInputEl = ref<HTMLInputElement | null>(null);
const toComboboxInputEl = ref<{ $el: HTMLElement } | null>(null);
const fromComboboxInputEl = ref<{ $el: HTMLElement } | null>(null);

function focusToCombobox() {
  toComboboxInputEl.value?.$el?.querySelector('input')?.focus();
}

function focusTimeInput() {
  timeInputEl.value?.focus();
}

defineExpose({ minutesRemaining, parseTime });
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
      <ZoneCombobox
        ref="fromComboboxInputEl"
        v-model="fromZoneId"
        placeholder="From zone…"
        data-testid="from-combobox"
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
        @tab-select="focusTimeInput"
      />
    </div>

    <!-- Time -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-gray-400 text-sm whitespace-nowrap">Expires:</label>
      <input
        ref="timeInputEl"
        v-model="timeInput"
        type="text"
        placeholder="H:MM"
        class="w-20 bg-gray-800 border border-gray-600 text-white text-sm rounded px-2 py-2 outline-none"
        :class="{ 'border-red-500': timeInput && minutesRemaining === null }"
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
      Report
    </button>

    <!-- Error -->
    <span v-if="error" class="text-red-400 text-xs">{{ error }}</span>
  </form>
</template>
