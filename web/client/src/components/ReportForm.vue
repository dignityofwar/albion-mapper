<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent, TooltipPortal } from 'reka-ui';
import ZoneCombobox from './ZoneCombobox.vue';
import TimeInput from './common/TimeInput.vue';
import { useRoomStore } from '../stores/useRoomStore.js';
import { addConnection } from '../utils/roomOperations.js';
import { ZONE_BY_ID } from 'shared';
import { API_BASE_URL } from '../utils/api';

const props = defineProps<{}>();

const store = useRoomStore();

const fromZoneId = ref('');
const fromHandleId = ref<string | null>(null);
const toZoneId = ref('');
const toHandleId = ref<string | null>(null);
const isLocked = computed(() => store.connections.length === 0);
const secondsRemaining = ref<number | null>(null);
watch([fromZoneId, toZoneId], () => {
  secondsRemaining.value = null;
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

const connectedToFromZone = computed(() => {
  if (!fromZoneId.value) return [];
  return store.connections
    .filter((c) => !c.isExpired && (c.fromZoneId === fromZoneId.value || c.toZoneId === fromZoneId.value))
    .map((c) => (c.fromZoneId === fromZoneId.value ? c.toZoneId : c.fromZoneId));
});

const canSubmit = computed(
  () => fromZoneId.value && toZoneId.value && secondsRemaining.value !== null && !submitting.value,
);

async function submit() {
  if (!canSubmit.value) return;
  submitting.value = true;

  try {
    await addConnection(
      store.roomId,
      store.token!,
      fromZoneId.value,
      toZoneId.value,
      Number(secondsRemaining.value!),
      fromHandleId.value || undefined,
      toHandleId.value || undefined,
      reportedBy.value || undefined,
    );

    emit('success', 'Connection added!');

    // Reset To, keep From (common for mapping multiple exits from one zone)
    fromHandleId.value = null; 
    // Reset "To" for next entry
    toZoneId.value = '';
    toHandleId.value = null;
    secondsRemaining.value = null;
  } catch (err: any) {
    emit('error', err.message || 'Failed to submit');
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

defineExpose({ 
  secondsRemaining, 
  fromZoneId, 
  setFromZoneId: (id: string, handleId?: string | null) => {
    fromZoneId.value = id;
    fromHandleId.value = handleId ?? null;
  }, 
  setConnection: (fromId: string, fHandleId: string | null, toId: string, tHandleId: string | null) => {
    fromZoneId.value = fromId;
    fromHandleId.value = fHandleId;
    toZoneId.value = toId;
    toHandleId.value = tHandleId;
  },
  focusTimeInput,
  focusToCombobox, 
  flashToCombobox 
});
</script>

<template>
  <div class="bg-gray-900 border-b border-gray-700 relative z-10">
    <form
      class="max-w-[1100px] mx-auto xl:ml-auto xl:mr-0 2xl:mx-auto flex flex-col md:flex-row md:items-center gap-2 md:gap-2 p-2.5 md:p-3"
      data-testid="report-form"
      @submit.prevent="submit"
    >

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
                  :error="secondsRemaining !== null && !fromZoneId"
                  :disabled="true"
                  icon="🏠"
                  @tab-select="focusToCombobox"
                  @select="focusToCombobox"
                  @update:model-value="fromHandleId = null"
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
          :error="secondsRemaining !== null && !fromZoneId"
          @tab-select="focusToCombobox"
          @select="focusToCombobox"
          @update:model-value="fromHandleId = null"
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
          :error="secondsRemaining !== null && !toZoneId"
          @tab-select="focusTimeInput"
          @select="focusTimeInput"
          @update:model-value="toHandleId = null"
        />
      </div>

      <!-- Time -->
      <div class="flex items-center gap-1 shrink-0">
        <label class="text-gray-400 text-sm whitespace-nowrap">Expires:</label>
        <TimeInput
          ref="timeInputEl"
          v-model="secondsRemaining"
          data-testid="time-input"
          @keydown="onTimeKeydown"
        />
        <!-- Submit -->
        <button
          type="submit"
          :disabled="!canSubmit"
          class="ml-1 px-6 py-3 md:py-2.5 rounded border border-transparent bg-indigo-600 text-white text-sm font-medium leading-none hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex-1 md:flex-none"
          data-testid="submit-button"
        >
          Add
        </button>
      </div>

      <!-- Error -->
    </form>
    <div class="max-w-[1100px] hidden md:block mx-auto xl:ml-auto xl:mr-0 2xl:mx-auto px-2.5 md:px-3 pb-2 md:pb-2.5 -mt-2 text-[11px] text-gray-400 text-center">
      Hint: Press <span class="bg-gray-700 text-white px-1.5 py-0.5 rounded text-[10px] font-mono uppercase">tab</span> to quickly move between fields,  <span class="bg-gray-700 text-white px-1.5 py-0.5 rounded text-[10px] font-mono uppercase">enter</span> to choose values. You can drag from the circles on a node to quickly add new ones.
    </div>
  </div>
</template>
