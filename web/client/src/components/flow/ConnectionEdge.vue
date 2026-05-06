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
import { ZONE_BY_ID, type Connection, getDefaultHandles, type ZoneType } from 'shared';
import { Z_INDEX } from '@/constants/Layers';

type EdgeData = {
  connection?: Connection;
  now?: number; // epoch ms, updated by parent interval
  hasChildren?: boolean;
  onDelete?: (id: string) => void;
  onDeleteRecursive?: (id: string) => void;
  onUpdate?: (id: string, secondsRemaining: number) => void;
  isGhost?: boolean;
  sourceFacing?: string;
  targetFacing?: string;
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
  return connectionStyle(remainingMs.value, isRestricted.value);
});

function getZoneName(id: string) {
  return ZONE_BY_ID.get(id)?.name ?? id;
}

const isCenter = (id?: string | null) => id === 'center' || id === 'center-overlay';

/**
 * Vue Flow passes edge sourceX/Y using getHandlePosition(..., center=false), which for a
 * Right-positioned handle gives x + width (the right edge), not the visual center.
 * The connection line preview uses center=true (x + width/2, y + height/2).
 * We replicate center=true here by looking up the handle's bounds directly.
 */
// Rotation degrees for each facing direction (matches CSS .facing-* classes)
const facingRotationDeg: Record<string, number> = {
  n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315,
};

function getTrueHandleCenter(node: any, handleId: string | null | undefined): { x: number; y: number } | null {
  if (!node) return null;
  if (isCenter(handleId)) {
    return {
      x: node.computedPosition.x + (node.dimensions.width ?? 0) / 2,
      y: node.computedPosition.y + (node.dimensions.height ?? 0) / 2,
    };
  }
  // Compute handle center from CSS left%/top% values — more reliable than handleBounds x/y
  // which can be affected by CSS transforms.
  const customHandles = node.data?.customHandles ?? node.data?.handles;
  const defaultHandles = getDefaultHandles(node.data?.type as ZoneType, node.data?.mapShape);
  const allHandleDefs = [...(customHandles ?? []), ...defaultHandles];
  const handleDef = handleId ? allHandleDefs.find((h: any) => h.id === handleId) : null;

  const nodeW = node.dimensions?.width ?? 0;
  const nodeH = node.dimensions?.height ?? 0;

  let cx: number, cy: number;
  if (handleDef) {
    const leftPct = parseFloat(handleDef.left) / 100;
    const topPct = parseFloat(handleDef.top) / 100;
    cx = node.computedPosition.x + leftPct * nodeW;
    cy = node.computedPosition.y + topPct * nodeH;
  } else {
    // Fall back to handleBounds center
    const allBounds = [...(node.handleBounds?.source ?? []), ...(node.handleBounds?.target ?? [])];
    const handle = handleId ? allBounds.find((h: any) => h.id === handleId) : allBounds[0];
    if (!handle) return null;
    cx = node.computedPosition.x + handle.x + handle.width / 2;
    cy = node.computedPosition.y + handle.y + handle.height / 2;
  }

  // The handle is a semicircle whose visual tip is at the top-center before rotation.
  // After CSS rotation by θ degrees, the tip is offset from the CSS origin by:
  //   dx = sin(θ) * r,  dy = -cos(θ) * r  where r = half the handle size (20px for 40px handle)
  const facing = handleId ? getHandleFacingFromId(handleId, node) : null;
  if (facing && facingRotationDeg[facing] !== undefined) {
    const theta = facingRotationDeg[facing] * (Math.PI / 180);
    const r = 20; // half of the 40px handle size
    return {
      x: cx + Math.sin(theta) * r,
      y: cy - Math.cos(theta) * r,
    };
  }

  return { x: cx, y: cy };
}

function getHandleFacingFromId(handleId: string, node: any): string | null {
  // First try position-based facing from custom handle data (matches CSS facing-* class logic)
  const customHandles: Array<{ id: string; top: string; left: string }> | undefined =
    node.data?.customHandles ?? node.data?.handles;
  if (customHandles) {
    const ch = customHandles.find((h: any) => h.id === handleId);
    if (ch) {
      const l = parseFloat(ch.left);
      const t = parseFloat(ch.top);
      if (Math.abs(l - 50) < 0.1 && Math.abs(t - 0) < 0.1) return 'n';
      if (Math.abs(l - 100) < 0.1 && Math.abs(t - 50) < 0.1) return 'e';
      if (Math.abs(l - 50) < 0.1 && Math.abs(t - 100) < 0.1) return 's';
      if (Math.abs(l - 0) < 0.1 && Math.abs(t - 50) < 0.1) return 'w';
      if (l >= 50 && t < 50) return 'ne';
      if (l > 50 && t >= 50) return 'se';
      if (l <= 50 && t > 50) return 'sw';
      return 'nw';
    }
  }
  // Fall back to default handles for the node's type/shape (e.g. roadsHideout)
  const defaultHandles = getDefaultHandles(node.data?.type as ZoneType, node.data?.mapShape);
  const dh = defaultHandles.find((h: any) => h.id === handleId);
  if (dh) {
    const l = parseFloat(dh.left);
    const t = parseFloat(dh.top);
    if (Math.abs(l - 50) < 0.1 && Math.abs(t - 0) < 0.1) return 'n';
    if (Math.abs(l - 100) < 0.1 && Math.abs(t - 50) < 0.1) return 'e';
    if (Math.abs(l - 50) < 0.1 && Math.abs(t - 100) < 0.1) return 's';
    if (Math.abs(l - 0) < 0.1 && Math.abs(t - 50) < 0.1) return 'w';
    if (l >= 50 && t < 50) return 'ne';
    if (l > 50 && t >= 50) return 'se';
    if (l <= 50 && t > 50) return 'sw';
    return 'nw';
  }
  // Last resort: derive facing from the handle id suffix
  for (const dir of ['ne', 'nw', 'se', 'sw', 'n', 'e', 's', 'w']) {
    if (handleId === dir || handleId.endsWith('-' + dir)) return dir;
  }
  return null;
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
    :style="{ stroke: style.stroke, strokeDasharray: style.strokeDasharray, strokeWidth: 2, opacity: isRestricted ? 0.3 : 1, animation: isRestricted ? 'none' : undefined }"
    class="cursor-pointer"
    @click.stop="showPopover = !showPopover"
    @mousedown.stop
  />
  
  <g v-if="!props.data?.isGhost && !isRestricted" class="pointer-events-none" :style="{ opacity: chevronsVisible ? 1 : 0, transition: 'opacity 0.3s ease' }">
    <path
      v-for="i in numChevrons"
      :key="`${chevronEpoch}-${i}`"
      d="M -6 -6 L 0 0 L -6 6"
      fill="none"
      stroke-width="3"
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
        class="text-xs px-3 h-7 inline-flex items-center justify-center rounded-full text-white cursor-pointer shadow-sm leading-none"
        :style="{ backgroundColor: style.color + 'b3', border: `1px solid ${style.stroke}` }"
        @click.stop="showPopover = !showPopover"
        @mousedown.stop
      >
        {{ isIsolated ? 'Isolated' : (isDirectlyExpired ? 'Expired' : formatCountdown(remainingMs)) }}
      </div>

      <!-- Popover -->
      <div
        v-if="showPopover"
        ref="popoverRef"
        class="absolute top-9 left-1/2 -translate-x-1/2 w-64 bg-gray-900 border border-gray-600 rounded shadow-lg p-3 text-xs text-white"
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
        <div v-if="data?.connection" class="mb-1">
          <span class="text-gray-400">Created:</span>
          {{ new Date(data.connection.reportedAt).toLocaleTimeString() }}
        </div>
        <div v-if="data?.connection" class="mb-2">
          <span class="text-gray-400">Expires:</span>
          {{ new Date(data.connection.expiresAt).toLocaleTimeString() }}
          <div class="mt-2 flex items-stretch gap-1">
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
        <div class="flex flex-col gap-2 mt-3">
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
</style>
