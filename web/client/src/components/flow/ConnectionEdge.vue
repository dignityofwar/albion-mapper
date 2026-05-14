<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick, inject, type Ref, onUpdated } from 'vue';
import { BaseEdge, EdgeLabelRenderer, useVueFlow } from '@vue-flow/core';
import type { EdgeProps } from '@vue-flow/core';
import { connectionStyle } from '@/utils/connectionStyle';
import { getConnectionPath } from '@/utils/connectionPath';
import { formatCountdown } from '@/utils/formatters';
import TimeInput from '../common/TimeInput.vue';
import TutorialTooltip from '../tutorial/TutorialTooltip.vue';
import { useTutorialStore } from '@/stores/useTutorialStore';
import { useRoomStore } from '@/stores/useRoomStore';
import { ZONE_BY_ID, type Connection } from 'shared';
import { getTrueHandleCenter, getHandleFacingFromId, isCenter } from '@/utils/handleCenter';
import { Z_INDEX } from '@/constants/Layers';

type EdgeData = {
  connection?: Connection;
  now?: number; // epoch ms, updated by parent interval
  hasChildren?: boolean;
  onDelete?: (id: string) => void;
  onDeleteRecursive?: (id: string) => void;
  onUpdate?: (id: string, secondsRemaining: number) => void;
  onUpdateSlots?: (id: string, slots: 7 | 20) => void;
  isGhost?: boolean;
  sourceFacing?: string;
  targetFacing?: string;
  slots?: 7 | 20;
  isPlotted?: boolean;
};

const props = defineProps<EdgeProps<EdgeData>>();
const { setCenter, onNodeDrag, onNodeDragStop } = useVueFlow();
const tutorialStore = useTutorialStore();
const roomStore = useRoomStore();

const showPopover = ref(false);
const isTutorialTooltipReady = ref(false);
const popoverRef = ref<HTMLElement | null>(null);
const newSecondsRemaining = ref<number | null>(null);

onMounted(() => {
  setTimeout(() => {
    isTutorialTooltipReady.value = true;
  }, 1000);
});

const openPopoverId = inject<Ref<string | null>>('openPopoverId');

watch(openPopoverId!, (newId) => {
  if (newId !== props.id) {
    showPopover.value = false;
  }
});

function closePopover(event: MouseEvent) {
  if (showPopover.value) {
    const target = event.target as HTMLElement;
    if (target.closest('[data-trigger="true"]')) return;
    if (popoverRef.value && popoverRef.value.contains(target)) return;
    showPopover.value = false;
    if (openPopoverId && openPopoverId.value === props.id) {
      openPopoverId.value = null;
    }
  }
}

function handleDelete(deleteFn: (id: string) => void) {
  deleteFn(props.id);
  showPopover.value = false;
  if (tutorialStore.step === 14) {
    tutorialStore.setStep(15);
  }
}

watch(showPopover, (val) => {
  if (val) {
    if (tutorialStore.step === 13) {
      tutorialStore.setStep(14);
    }
    if (props.data?.isGhost) {
      showPopover.value = false;
      return;
    }
    if (openPopoverId) {
      openPopoverId.value = props.id;
    }
    newSecondsRemaining.value = null;
    isTutorialTooltipReady.value = false;
    setTimeout(() => {
      isTutorialTooltipReady.value = true;
    }, 200);
    nextTick(() => {
      document.addEventListener('click', closePopover);
      if (window.innerWidth < 768) {
        setCenter(labelX.value, labelY.value + 100, { duration: 600, zoom: 1.4 });
      }
    });
  } else {
    document.removeEventListener('click', closePopover);
  }
});

onUnmounted(() => {
  document.removeEventListener('click', closePopover);
});

const expiresMs = computed(() => {
  if (!props.data?.connection) return 0;
  return new Date(props.data.connection.expiresAt).getTime();
});
const remainingMs = computed(() => {
  if (!props.data?.now) return 0;
  return expiresMs.value - props.data.now;
});

const isDirectlyExpired = computed(() => {
  if (!props.data?.connection) return false;
  return (props.data.connection.isExpired ?? false) || remainingMs.value <= 0;
});

const isExpired = computed(() => {
  return isDirectlyExpired.value;
});

const isIsolated = computed(() => {
  if (!props.data?.connection) return false;
  return roomStore.isEdgeIsolated(props.data.connection.id, props.data.now ?? 0);
});

const isRestricted = computed(() => isExpired.value || isIsolated.value);

const style = computed(() => {
  if (props.data?.isGhost) {
    return {
      stroke: '#6366f1',
      strokeDasharray: '5,5',
      animated: true,
      color: '#6366f1'
    };
  }
  if (props.data?.isPlotted) {
    return {
      stroke: '#3b82f6',
      strokeDasharray: undefined,
      animated: false,
      color: '#1d4ed8'
    };
  }
  return connectionStyle(remainingMs.value, isRestricted.value);
});

const isPlotted = computed(() => props.data?.isPlotted ?? false);

function getZoneName(id: string) {
  return ZONE_BY_ID.get(id)?.name ?? id;
}


const srcCenter = computed(() => getTrueHandleCenter(props.sourceNode, props.sourceHandleId));
const tgtCenter = computed(() => getTrueHandleCenter(props.targetNode, props.targetHandleId || 'center'));

const pathData = computed(() => {
  const srcHandleId = props.sourceHandleId;
  const tgtHandleId = props.targetHandleId || 'center';

  // Use position-based facing (matches CSS facing-* class) when available
  const srcFacing = srcHandleId && !isCenter(srcHandleId)
    ? (getHandleFacingFromId(srcHandleId, props.sourceNode) ?? props.data?.sourceFacing ?? props.sourcePosition)
    : props.sourcePosition;
  const tgtFacing = tgtHandleId && !isCenter(tgtHandleId)
    ? (getHandleFacingFromId(tgtHandleId, props.targetNode) ?? props.data?.targetFacing ?? props.targetPosition)
    : props.targetPosition;

  return getConnectionPath({
    sourceX: srcCenter.value?.x ?? props.sourceX,
    sourceY: srcCenter.value?.y ?? props.sourceY,
    targetX: tgtCenter.value?.x ?? props.targetX,
    targetY: tgtCenter.value?.y ?? props.targetY,
    sourcePosition: srcFacing as any,
    targetPosition: tgtFacing as any,
    sourceHandleId: srcHandleId,
    targetHandleId: tgtHandleId,
    forceStraight: false,
  });
});
const path = computed(() => pathData.value[0]);
const distance = computed(() => Math.sqrt((props.targetX - props.sourceX) ** 2 + (props.targetY - props.sourceY) ** 2));

const isDragging = ref(false);
const stableDistance = ref(distance.value);
const chevronsVisible = ref(true);
const chevronEpoch = ref(0);

onNodeDrag(({ node }) => {
  if (node.id === props.source || node.id === props.target) {
    isDragging.value = true;
    chevronsVisible.value = false;
  }
});
onNodeDragStop(({ node }) => {
  if (node.id === props.source || node.id === props.target) {
    isDragging.value = false;
    stableDistance.value = distance.value;
    chevronEpoch.value++;
    // Fade back in after recalculating
    nextTick(() => {
      chevronsVisible.value = true;
    });
  }
});

watch(distance, (val) => {
  if (!isDragging.value) {
    stableDistance.value = val;
  }
}, { immediate: true });

const duration = computed(() => Math.max(1, stableDistance.value / 100));
const numChevrons = computed(() => Math.max(1, Math.round(stableDistance.value / 100)));

const labelX = computed(() => pathData.value[1]);
const labelY = computed(() => pathData.value[2]);

defineExpose({
  showPopover,
});
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path"
    :animated="style.animated"
    :style="{ stroke: style.stroke, strokeDasharray: style.strokeDasharray, strokeWidth: isPlotted ? 3 : 2, opacity: isRestricted ? 0.3 : 1, animation: isPlotted ? 'pulse-blue-stroke 0.75s infinite ease-in-out' : (isRestricted ? 'none' : undefined) }"
    class="cursor-pointer"
    @click.stop="showPopover = !showPopover"
    @mousedown.stop
  />
  
  <g v-if="!props.data?.isGhost && !isRestricted" class="pointer-events-none" :style="{ opacity: chevronsVisible ? 1 : 0, transition: 'opacity 0.3s ease' }">
    <path
      v-for="i in numChevrons"
      :key="`${chevronEpoch}-${i}`"
      :d="isPlotted ? 'M -18 -18 L 0 0 L -18 18' : 'M -6 -6 L 0 0 L -6 6'"
      fill="none"
      :stroke-width="isPlotted ? 4 : 3"
      stroke-linecap="round"
      stroke-linejoin="round"
      :stroke="style.stroke"
      stroke-opacity="0"
      stroke-dasharray="0"
      style="stroke-dasharray: 0;"
    >
      <animateMotion
        :dur="`${duration}s`"
        :begin="`${(i - 1) * (duration / numChevrons)}s`"
        repeatCount="indefinite"
        :path="path"
        rotate="auto"
      />
      <animate 
        attributeName="stroke-opacity"
        values="0;1;1;0"
        keyTimes="0;0.1;0.9;1"
        :dur="`${duration}s`"
        :begin="`${(i - 1) * (duration / numChevrons)}s`"
        repeatCount="indefinite"
      />
    </path>
  </g>

  <EdgeLabelRenderer v-if="!props.data?.isGhost">
     <TutorialTooltip
          v-if="isTutorialTooltipReady && !tutorialStore.completed && tutorialStore.step === 13"
          message="Click on the rounded pill with the time."
          containerClass="absolute -top-24 left-1/2 -translate-x-3/4"
          :class="Z_INDEX.OVERLAY"
        />
    <div
      :style="{
        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
        pointerEvents: 'all',
      }"
      :class="['absolute nodrag nopan', showPopover ? Z_INDEX.POPOVER_ACTIVE : Z_INDEX.CONNECTION_PILL]"
    >
      <!-- Countdown label -->
      <div
        data-trigger="true"
        class="text-xs px-3 py-2 inline-flex flex-col items-center justify-center gap-0.5 rounded-full text-white cursor-pointer backdrop-blur-sm"
        :style="{ backgroundColor: style.color + 'b3', border: `1px solid ${style.stroke}` }"
        @click.stop="showPopover = !showPopover"
        @mousedown.stop
      >
        <span class="leading-none">{{ isIsolated ? 'Isolated' : (isDirectlyExpired ? 'Expired' : formatCountdown(remainingMs)) }}</span>
        <span
          v-if="props.data?.slots !== undefined && !isRestricted"
          class="text-[10px] leading-none mt-0.5 px-1.5 pt-0.5 pb-1 rounded-full font-bold text-white border"
          :class="props.data.slots === 20 ? 'bg-yellow-600/50 border-yellow-500' : 'bg-blue-600/60 border-blue-300'"
        >{{ props.data.slots }} slots</span>
      </div>

      <!-- Popover -->
      <div
        v-if="showPopover"
        ref="popoverRef"
        class="absolute top-[58px] left-1/2 -translate-x-1/2 w-64 bg-gray-900 border border-gray-600 rounded shadow-lg p-3 text-xs text-white"
        @click.stop
        @mousedown.stop
      >
        <TutorialTooltip
          v-if="isTutorialTooltipReady && !tutorialStore.completed && tutorialStore.step === 14"
          message="Here you can edit the connection and update the time if you made a mistake. Deleting this connection will delete the node. If there are multiple connections in a chain, there will be a button to delete the whole chain beyond this connection. Delete the connection to continue."
          pointing="down"
          containerClass="absolute -top-[115px] left-1/2 -translate-x-1/2 w-64"
          :class="Z_INDEX.OVERLAY"
        />
        <button
          class="absolute top-2 right-2 text-gray-400 hover:text-white p-1"
          @click.stop="showPopover = false"
        >
          ✕
        </button>
        <div class="text-sm font-bold mb-2 text-center">
          <div v-if="data?.connection">{{ getZoneName(data.connection.fromZoneId) }}</div>
          <div class="text-xs text-gray-400 font-normal">to</div>
          <div v-if="data?.connection">{{ getZoneName(data.connection.toZoneId) }}</div>
        </div>
        <div v-if="data?.connection?.reportedBy" class="mb-1">
          <span class="text-gray-400">By:</span> {{ data.connection.reportedBy }}
        </div>
        <div v-if="data?.connection" class="mb-2">
          <div class="flex gap-2 text-center">
            <div class="text-xs text-gray-400 flex-1">Created</div>
            <div class="text-xs text-gray-400 flex-1">Expires</div>
          </div>
          <div class="flex gap-2 text-center">
            <div class="text-xs flex-1">{{ new Date(data.connection.reportedAt).toLocaleTimeString() }}</div>
            <div class="text-xs flex-1">{{ new Date(data.connection.expiresAt).toLocaleTimeString() }}</div>
          </div>
          <div class="text-xs text-gray-400 mt-2 mb-1 text-center">Time Remaining</div>
          <div class="flex items-stretch gap-1">
            <TimeInput v-model="newSecondsRemaining" compact class="flex-1" @enter="newSecondsRemaining !== null && data?.onUpdate?.(id, newSecondsRemaining!) && (showPopover = false)" />
            <button
              :disabled="newSecondsRemaining === null"
              class="bg-indigo-700 hover:bg-indigo-600 text-white rounded px-2 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Update Connection"
              @click.stop="data?.onUpdate?.(id, newSecondsRemaining!); showPopover = false"
            >
              Update
            </button>
          </div>
        </div>
        <div class="mb-3">
          <div class="text-xs text-gray-400 mb-1 text-center">Slots</div>
          <div class="flex gap-2">
            <button
              class="flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors"
              :class="props.data?.slots === 7 ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'"
              @click.stop="data?.onUpdateSlots?.(id, 7)"
            >7</button>
            <button
              class="flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors"
              :class="props.data?.slots === 20 ? 'bg-yellow-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'"
              @click.stop="data?.onUpdateSlots?.(id, 20)"
            >20</button>
          </div>
          <hr class="border-gray-600 mt-3" />
        </div>
        <div class="flex flex-col gap-2">
          <template v-if="data?.hasChildren">
            <div class="flex gap-2">
              <button
                class="flex-1 px-1 py-1.5 rounded bg-red-700 hover:bg-red-600 text-white text-[10px] font-medium leading-tight"
                @click.stop="handleDelete(data?.onDelete!)"
              >
                Delete
              </button>
              <button
                class="flex-1 px-1 py-1.5 rounded bg-red-700 hover:bg-red-600 text-white text-[10px] font-medium leading-tight"
                @click.stop="handleDelete(data?.onDeleteRecursive!)"
              >
                Delete this & connected
              </button>
            </div>
          </template>
          <div v-else>
            <button
              class="w-full px-2 py-1.5 rounded bg-red-700 hover:bg-red-600 text-white text-xs font-medium"
              @click.stop="handleDelete(data?.onDelete!)"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </EdgeLabelRenderer>
</template>

<style scoped>
@keyframes dash {
  from {
    stroke-dashoffset: 0;
  }
  to {
    stroke-dashoffset: -18;
  }
}

@keyframes pulse-blue-stroke {
  0%, 100% {
    stroke: #3b82f6;
  }
  50% {
    stroke: #93c5fd;
  }
}
</style>
