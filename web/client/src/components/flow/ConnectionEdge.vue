<script setup lang="ts">
import { computed, ref, watch, onUnmounted, nextTick, inject, type Ref } from 'vue';
import { BaseEdge, EdgeLabelRenderer, getStraightPath, useVueFlow } from '@vue-flow/core';
import type { EdgeProps } from '@vue-flow/core';
import { connectionStyle } from '../../utils/connectionStyle.js';
import { formatCountdown } from '../../utils/formatters.js';
import TimeInput from '../common/TimeInput.vue';
import { ZONE_BY_ID, type Connection } from 'shared';

type EdgeData = {
  connection: Connection;
  now: number; // epoch ms, updated by parent interval
  hasChildren: boolean;
  onDelete: (id: string) => void;
  onDeleteRecursive: (id: string) => void;
  onUpdate: (id: string, secondsRemaining: number) => void;
};

const props = defineProps<EdgeProps<EdgeData>>();
const { setCenter } = useVueFlow();

const showPopover = ref(false);
const popoverRef = ref<HTMLElement | null>(null);
const newSecondsRemaining = ref<number | null>(null);

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

watch(showPopover, (val) => {
  if (val) {
    if (openPopoverId) {
      openPopoverId.value = props.id;
    }
    newSecondsRemaining.value = null;
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

const expiresMs = computed(() => new Date(props.data.connection.expiresAt).getTime());
const remainingMs = computed(() => expiresMs.value - props.data.now);
const isExpired = computed(() => props.data.connection.isExpired ?? false);

const style = computed(() => connectionStyle(remainingMs.value, isExpired.value));

function getZoneName(id: string) {
  return ZONE_BY_ID.get(id)?.name ?? id;
}

const straight = computed(() =>
  getStraightPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
  }),
);
const path = computed(() => straight.value[0]);
const labelX = computed(() => straight.value[1]);
const labelY = computed(() => straight.value[2]);

defineExpose({
  showPopover,
});
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path"
    :animated="style.animated"
    :style="{ stroke: style.stroke, strokeDasharray: style.strokeDasharray, strokeWidth: 2 }"
    class="cursor-pointer"
    @click="showPopover = !showPopover"
  />

  <EdgeLabelRenderer>
    <div
      :style="{
        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
        pointerEvents: 'all',
      }"
      :class="['absolute nodrag nopan', showPopover ? 'z-[7000]' : 'z-[5000]']"
    >
      <!-- Countdown label -->
      <div
        data-trigger="true"
        class="text-xs px-3 h-7 inline-flex items-center justify-center rounded-full text-white cursor-pointer shadow-sm leading-none"
        :style="{ backgroundColor: style.color, border: `1px solid ${style.stroke}` }"
        @click="showPopover = !showPopover"
      >
        {{ formatCountdown(remainingMs) }}
      </div>

      <!-- Popover -->
      <div
        v-if="showPopover"
        ref="popoverRef"
        class="absolute top-9 left-1/2 -translate-x-1/2 w-48 bg-gray-900 border border-gray-600 rounded shadow-lg p-3 text-xs text-white"
        @click.stop
      >
        <button
          class="absolute top-2 right-2 text-gray-400 hover:text-white p-1"
          @click.stop="showPopover = false"
        >
          ✕
        </button>
        <div class="text-sm font-bold mb-2 text-center">
          <div>{{ getZoneName(data.connection.fromZoneId) }}</div>
          <div class="text-xs text-gray-400 font-normal">to</div>
          <div>{{ getZoneName(data.connection.toZoneId) }}</div>
        </div>
        <div v-if="data.connection.reportedBy" class="mb-1">
          <span class="text-gray-400">By:</span> {{ data.connection.reportedBy }}
        </div>
        <div class="mb-1">
          <span class="text-gray-400">Created:</span>
          {{ new Date(data.connection.reportedAt).toLocaleTimeString() }}
        </div>
        <div class="mb-2">
          <span class="text-gray-400">Expires:</span>
          {{ new Date(data.connection.expiresAt).toLocaleTimeString() }}
          <div class="mt-2 flex items-stretch gap-1">
            <TimeInput v-model="newSecondsRemaining" compact class="flex-1" @enter="newSecondsRemaining !== null && (data.onUpdate(id, newSecondsRemaining!), showPopover = false)" />
            <button
              :disabled="newSecondsRemaining === null"
              class="bg-indigo-700 hover:bg-indigo-600 text-white rounded px-2 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Update Connection"
              @click.stop="data.onUpdate(id, newSecondsRemaining!); showPopover = false"
            >
              ↵
            </button>
          </div>
        </div>
        <div class="flex flex-col gap-2 mt-3">
          <template v-if="data.hasChildren">
            <div class="flex gap-2">
              <button
                class="flex-1 px-1 py-1.5 rounded bg-red-700 hover:bg-red-600 text-white text-[10px] font-medium leading-tight"
                @click.stop="data.onDelete(id); showPopover = false"
              >
                Delete
              </button>
              <button
                class="flex-1 px-1 py-1.5 rounded bg-red-700 hover:bg-red-600 text-white text-[10px] font-medium leading-tight"
                @click.stop="data.onDeleteRecursive(id); showPopover = false"
              >
                Delete this & connected
              </button>
            </div>
          </template>
          <div v-else>
            <button
              class="w-full px-2 py-1.5 rounded bg-red-700 hover:bg-red-600 text-white text-xs font-medium"
              @click.stop="data.onDelete(id); showPopover = false"
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
:deep(.vue-flow__edge-path.animated) {
  animation: dash 1s linear infinite;
}

@keyframes dash {
  from {
    stroke-dashoffset: 0;
  }
  to {
    stroke-dashoffset: -18;
  }
}
</style>
