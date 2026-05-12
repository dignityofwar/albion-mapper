<script setup lang="ts">
import { ref, computed, watch, nextTick, inject } from 'vue';
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent, TooltipPortal } from 'reka-ui';
import ZoneCombobox from './ZoneCombobox.vue';
import TutorialTooltip from './tutorial/TutorialTooltip.vue';
import TimeInput from './common/TimeInput.vue';
import { useRoomStore } from '@/stores/useRoomStore';
import { useTutorialStore } from '@/stores/useTutorialStore';
import { addConnection } from '@/utils/roomOperations';
import { ZONE_BY_ID, getHandleFacing } from 'shared';
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
const isConnectionMode = ref(false);
const showLoopWarning = ref(false);
const secondsRemaining = ref<number | null>(null);
const slots = ref<7 | 20>(7);
const isRoadsZone = computed(() => {
  if (!toZoneId.value) return false;
  const zone = ZONE_BY_ID.get(toZoneId.value);
  return zone?.type === 'roads';
});
const isHideoutZone = computed(() => {
  if (!toZoneId.value) return false;
  const zone = ZONE_BY_ID.get(toZoneId.value);
  return !!(zone as any)?.isRoadsHideout;
});
const isRoyalOrOutlands = computed(() => {
  if (!toZoneId.value) return false;
  const zone = ZONE_BY_ID.get(toZoneId.value);
  if (!zone) return false;
  return zone.type.startsWith('royal') || zone.type === 'outlands';
});
watch([fromZoneId, toZoneId], () => {
  secondsRemaining.value = null;
});
watch(toZoneId, (newId) => {
  emit('update:toZoneId', newId);
  if (!tutorialStore.completed && tutorialStore.step === 1 && newId) {
    tutorialStore.setStep(2);
  }
  if (!newId) return;
  const zone = ZONE_BY_ID.get(newId);
  if (!zone || zone.type.startsWith('royal') || zone.type === 'outlands') {
    slots.value = 7;
  }
});
const reportedBy = ref('');
const submitting = ref(false);

watch(isOpen, (newVal) => {
  if (newVal) {
    nextTick(() => {
      isModalReady.value = true;
      if (isConnectionMode.value) {
        focusTimeInput();
      } else {
        focusToCombobox();
      }
    });
  } else {
    isModalReady.value = false;
    isConnectionMode.value = false;
    showLoopWarning.value = false;
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

function isPortalOccupied(zoneId: string, handleId: string | null) {
  const hId = handleId || 'center';
  if (hId === 'center') return false;
  return store.connections.some(c => 
    !c.isExpired && (
      (c.fromZoneId === zoneId && (c.fromHandleId || 'center') === hId) ||
      (c.toZoneId === zoneId && (c.toHandleId || 'center') === hId)
    )
  );
}

const canSubmit = computed(
  () => fromZoneId.value && toZoneId.value && secondsRemaining.value !== null && !submitting.value,
);

function getFallbackPosition(sourceZoneId: string, handleId: string | null): { x: number; y: number } | undefined {
  const sourceNode = store.nodePositions.find(n => n.zoneId === sourceZoneId);
  if (!sourceNode) return { x: 300, y: 300 };

  let facing = 'se'; // default
  const hid = handleId ?? 'center';

  if (['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].includes(hid)) {
    facing = hid;
  } else if (hid === 'center') {
    facing = 'se';
  } else {
    // custom handle — look up left/top
    const customHandle = sourceNode.customHandles?.find(h => h.id === hid);
    if (customHandle) {
      facing = getHandleFacing(customHandle.left, customHandle.top);
    }
  }

  const DIST = 300;
  const offsets: Record<string, { dx: number; dy: number }> = {
    n:  { dx: 0,     dy: -DIST },
    s:  { dx: 0,     dy:  DIST },
    e:  { dx: DIST,  dy: 0     },
    w:  { dx: -DIST, dy: 0     },
    ne: { dx: DIST,  dy: -DIST },
    nw: { dx: -DIST, dy: -DIST },
    se: { dx: DIST,  dy:  DIST },
    sw: { dx: -DIST, dy:  DIST },
  };
  const { dx, dy } = offsets[facing] ?? offsets['se'];
  return { x: sourceNode.x + dx, y: sourceNode.y + dy };
}

async function submitAndAddMore() {
  if (!canSubmit.value) return;

  if (!isConnectionMode.value && (isPortalOccupied(fromZoneId.value, fromHandleId.value) || isPortalOccupied(toZoneId.value, toHandleId.value))) {
    emit('error', 'It is not possible to connect already connected portals.');
    return;
  }

  submitting.value = true;

  // If connecting two existing zones, do NOT send a position — the target node already exists
  // and sending a position would overwrite it (moving the node).
  const resolvedPosition = isConnectionMode.value
    ? undefined
    : (targetPosition.value?.x != null && targetPosition.value?.y != null)
      ? targetPosition.value
      : getFallbackPosition(fromZoneId.value, fromHandleId.value);

  console.log('[ReportForm] resolvedPosition for submission:', resolvedPosition);

  try {
    await addConnection(
      store.roomId,
      store.token!,
      fromZoneId.value,
      toZoneId.value,
      Number(secondsRemaining.value!),
      slots.value,
      fromHandleId.value || 'center',
      toHandleId.value || 'center',
      reportedBy.value || undefined,
      resolvedPosition,
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
    console.log('[ReportForm] targetPosition from drag event:', pos ?? null);
    open();
  }, 
  setConnection: (fromId: string, fHandleId: string | null, toId: string, tHandleId: string | null, loopWarning = false) => {
    fromZoneId.value = fromId;
    fromHandleId.value = fHandleId;
    toZoneId.value = toId;
    toHandleId.value = tHandleId;
    targetPosition.value = null;
    isConnectionMode.value = true;
    showLoopWarning.value = loopWarning;
    open();
  },
  focusTimeInput,
  focusToCombobox, 
  flashToCombobox,
  setTargetPosition: (pos: { x: number, y: number }) => {
    targetPosition.value = pos;
  },
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

        <div v-if="showLoopWarning" class="mb-4 rounded-lg bg-yellow-900/50 border border-yellow-600 px-4 py-3 text-yellow-300 text-sm">
          ⚠️ Adding this connection will create a loop — double check this is correct.
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
          
          <!-- Time + Slots -->
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5" ref="timeInputContainer">
              <label class="text-sm font-medium text-gray-400 text-center">Expires In</label>
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
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-400 text-center">Slots</label>
              <div class="flex gap-2">
                <button
                  type="button"
                  :class="['flex-1 px-3 py-2 rounded border text-sm font-semibold transition-colors', slots === 7 ? 'bg-blue-600 border-gray-400 text-white' : 'bg-gray-800 border-gray-400 text-gray-300 hover:bg-gray-600']"
                  @click="slots = 7"
                >7</button>
                <button
                  type="button"
                  :class="['flex-1 px-3 py-2 rounded border text-sm font-semibold transition-colors', slots === 20 ? 'bg-yellow-600 border-gray-300 text-white' : 'bg-gray-800 border-gray-400 text-gray-300 hover:bg-gray-600', isRoyalOrOutlands && 'opacity-50 cursor-not-allowed']"
                  :disabled="isRoyalOrOutlands"
                  @click="slots = 20"
                >20</button>
              </div>
            </div>
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

        <div class="pt-4 text-[12px] text-gray-500 leading-relaxed">
          <p><strong>Hint:</strong> Press <span class="key">tab</span> to move between fields, <span class="key">enter</span> to submit. This saves you time entering the data and reduces risk.</p>
        </div>
      </div>
    </div>
  </div>
</template>
