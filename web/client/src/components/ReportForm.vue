<script setup lang="ts">
import { ref, computed, watch, nextTick, inject } from 'vue';
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent, TooltipPortal } from 'reka-ui';
import ZoneCombobox from './ZoneCombobox.vue';
import TutorialTooltip from './tutorial/TutorialTooltip.vue';
import TimeInput from './common/TimeInput.vue';
import { useRoomStore } from '@/stores/useRoomStore';
import { useTutorialStore } from '@/stores/useTutorialStore';
import { addConnection } from '@/utils/roomOperations';
import { ZONE_BY_ID } from 'shared';
import { Z_INDEX } from '@/constants/Layers';

const props = defineProps<{}>();

const store = useRoomStore();
const tutorialStore = useTutorialStore();
const goToNode = inject<(nodeId: string) => void>('goToNode');

const toZoneContainer = ref<HTMLElement | null>(null);
const timeInputContainer = ref<HTMLElement | null>(null);

const isOpen = ref(false);
const isModalReady = ref(false);
const fromZoneId = ref('');
const fromHandleId = ref<string | null>(null);
const toZoneId = ref('');
const toHandleId = ref<string | null>(null);
const targetPosition = ref<{ x: number, y: number } | null>(null);
const isLocked = computed(() => store.connections.length === 0);
const secondsRemaining = ref<number | null>(null);
watch([fromZoneId, toZoneId], () => {
  secondsRemaining.value = null;
});
watch(toZoneId, (newId) => {
  emit('update:toZoneId', newId);
  if (!tutorialStore.completed && tutorialStore.step === 1 && newId) {
    tutorialStore.setStep(2);
  }
});
const reportedBy = ref('');
const submitting = ref(false);

watch(isOpen, (newVal) => {
  if (newVal) {
    nextTick(() => {
      isModalReady.value = true;
      focusToCombobox();
    });
  } else {
    isModalReady.value = false;
  }
});

function getZoneName(id: string) {
  return ZONE_BY_ID.get(id)?.name ?? id;
}

const emit = defineEmits<{
  success: [message: string];
  error: [message: string];
  close: [];
  'update:toZoneId': [id: string];
}>();

function open() {
  isOpen.value = true;
  if (!fromZoneId.value && store.homeZoneId) {
    fromZoneId.value = store.homeZoneId;
  }
  if (!tutorialStore.completed && tutorialStore.step === 0) {
    tutorialStore.setStep(1);
  }
}

function close() {
  isOpen.value = false;
  // Reset "To" and time when closing, but maybe keep "From"?
  // The user might want to reopen it for the same From zone.
  toZoneId.value = '';
  toHandleId.value = null;
  targetPosition.value = null;
  secondsRemaining.value = null;
  emit('close');
}

const connectedToFromZone = computed(() => {
  if (!fromZoneId.value) return [];
  return store.connections
    .filter((c) => !c.isExpired && (c.fromZoneId === fromZoneId.value || c.toZoneId === fromZoneId.value))
    .map((c) => (c.fromZoneId === fromZoneId.value ? c.toZoneId : c.fromZoneId));
});

const canSubmit = computed(
  () => fromZoneId.value && toZoneId.value && secondsRemaining.value !== null && !submitting.value,
);

async function submitAndAddMore() {
  if (!canSubmit.value) return;

  submitting.value = true;

  try {
    await addConnection(
      store.roomId,
      store.token!,
      fromZoneId.value,
      toZoneId.value,
      Number(secondsRemaining.value!),
      fromHandleId.value || 'center',
      toHandleId.value || 'center',
      reportedBy.value || undefined,
      targetPosition.value || undefined,
    );

    emit('success', 'Connection added!');

    if (!tutorialStore.completed && tutorialStore.step === 2) {
      if (toZoneId.value) {
        tutorialStore.setLastAddedNodeId(toZoneId.value);
        tutorialStore.setStep(3);
        goToNode?.(toZoneId.value);
      }
      close();
      return;
    }

    if (!tutorialStore.completed && tutorialStore.step === 11 && targetPosition.value) {
      tutorialStore.setStep(12);
      close();
      return;
    }

    if (!tutorialStore.completed && tutorialStore.step === 12) {
      tutorialStore.setStep(13);
      close();
      return;
    }

    // Reset To, keep From (common for mapping multiple exits from one zone)
    fromHandleId.value = null; 
    // Reset "To" for next entry
    toZoneId.value = '';
    toHandleId.value = null;
    targetPosition.value = null;
    secondsRemaining.value = null;

    nextTick(() => {
      focusToCombobox();
    });
  } catch (err: any) {
    emit('error', err.message || 'Failed to submitAndAddMore');
  } finally {
    submitting.value = false;
  }
}

async function submitAndClose() {
  await submitAndAddMore();
  close();
}

function onTimeKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') submitAndClose();
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
  toZoneId,
  open,
  close,
  setFromZoneId: (id: string, handleId?: string | null, pos?: { x: number, y: number }) => {
    fromZoneId.value = id;
    fromHandleId.value = handleId ?? null;
    targetPosition.value = pos ?? null;
    open();
  }, 
  setConnection: (fromId: string, fHandleId: string | null, toId: string, tHandleId: string | null) => {
    fromZoneId.value = fromId;
    fromHandleId.value = fHandleId;
    toZoneId.value = toId;
    toHandleId.value = tHandleId;
    targetPosition.value = null;
    open();
  },
  focusTimeInput,
  focusToCombobox, 
  flashToCombobox 
});
</script>

<template>
  <div v-show="isOpen">
    <div
      class="fixed inset-0 bg-black/60 flex items-center justify-center p-4"
      :class="Z_INDEX.MODAL"
      @click.self="close"
    >
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-xl shadow-2xl" @click.stop>
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-white">Add Connection</h2>
          <button @click="close" class="text-gray-400 hover:text-white transition-colors p-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <form
          class="flex flex-col gap-5"
          data-testid="report-form"
          @submit.prevent="submitAndClose"
        >
          <!-- From -->
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-400">From Zone</label>
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
                      :only-roads-hideout="!tutorialStore.completed"
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
              :only-roads-hideout="!tutorialStore.completed"
              @tab-select="focusToCombobox"
              @select="focusToCombobox"
              @update:model-value="(_) => { if (fromHandleId && !fromHandleId.startsWith('default-')) fromHandleId = null; }"
            />
          </div>

          <!-- To -->
          <div ref="toZoneContainer">
            <TutorialTooltip
              v-if="isModalReady && !tutorialStore.completed && tutorialStore.step === 1 && toZoneContainer"
              :target="toZoneContainer"
              message="Enter your destination zone by hovering over the portal in game for its name. For tutorial purposes you can only choose hideouts."
              pointing="down"
              containerClass="w-72"
              :offset-y="20"
            />
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-400">To Zone</label>
              <ZoneCombobox
                ref="toComboboxInputEl"
                v-model="toZoneId"
                placeholder="To zone…"
                :excluded-ids="[fromZoneId, ...connectedToFromZone]"
                :smart-already-added="true"
                already-added-placement="bottom"
                data-testid="to-combobox"
                :error="secondsRemaining !== null && !toZoneId"
                :only-roads-hideout="!tutorialStore.completed"
                @tab-select="focusTimeInput"
                @select="focusTimeInput"
                @update:model-value="(_) => { if (toHandleId && !toHandleId.startsWith('default-')) toHandleId = null; }"
              />
            </div>
          </div>
          
          <!-- Time -->
          <div class="flex flex-col gap-1.5" ref="timeInputContainer">
            <label class="text-sm font-medium text-gray-400">Expires In</label>
            <TutorialTooltip
              v-if="isModalReady && !tutorialStore.completed && tutorialStore.step === 2 && timeInputContainer"
              :target="timeInputContainer"
              message="You can find this by hovering over the portal in game."
              pointing="up"
            />
            <TimeInput
              ref="timeInputEl"
              v-model="secondsRemaining"
              data-testid="time-input"
              @keydown="onTimeKeydown"
            />
          </div>

          <!-- Buttons -->
          <div class="flex gap-3">
            <button
              type="button"
              :disabled="!canSubmit"
              class="flex-1 px-4 py-2.5 rounded bg-gray-700 text-white font-semibold hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="submitAndAddMore-button"
              @click="submitAndAddMore"
            >
              {{ submitting ? 'Adding...' : 'Save and add more' }}
            </button>
            <button
              type="submit"
              :disabled="!canSubmit"
              class="flex-1 px-4 py-2.5 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save and Close
            </button>
          </div>
        </form>

        <div class="mt-8 pt-4 border-t border-gray-800 text-[12px] text-gray-500 leading-relaxed">
          <p><strong>Hint:</strong> Press <span class="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded border border-gray-700 font-mono text-[10px] uppercase">tab</span> to move between fields, <span class="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded border border-gray-700 font-mono text-[10px] uppercase">enter</span> to submit. Drag from node circles to quickly add connections.</p>
        </div>
      </div>
    </div>
  </div>
</template>
