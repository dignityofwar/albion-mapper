<script setup lang="ts">
import { computed, ref } from 'vue';
import { EdgeLabelRenderer, getBezierPath } from '@vue-flow/core';
import { connectionStyle } from '../../utils/connectionStyle.js';
import type { Connection } from 'shared';

const props = defineProps<{
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  data: {
    connection: Connection;
    now: number; // epoch ms, updated by parent interval
    onDelete: (id: string) => void;
  };
}>();

const showPopover = ref(false);

const expiresMs = computed(() => new Date(props.data.connection.expiresAt).getTime());
const remainingMs = computed(() => expiresMs.value - props.data.now);
const isStale = computed(() => remainingMs.value < 0 && remainingMs.value > -6 * 60 * 60 * 1000);

const style = computed(() => connectionStyle(remainingMs.value, isStale.value));

const [path, labelX, labelY] = getBezierPath({
  sourceX: props.sourceX,
  sourceY: props.sourceY,
  targetX: props.targetX,
  targetY: props.targetY,
});

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Expired';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
</script>

<template>
  <path
    :id="id"
    :d="path"
    :stroke="style.stroke"
    :stroke-dasharray="style.strokeDasharray"
    stroke-width="2"
    fill="none"
    class="cursor-pointer"
    @click="showPopover = !showPopover"
  />

  <EdgeLabelRenderer>
    <div
      :style="{
        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
        pointerEvents: 'all',
      }"
      class="absolute nodrag nopan"
    >
      <!-- Countdown label -->
      <div
        class="text-xs px-1 rounded bg-gray-900/80 text-white cursor-pointer"
        @click="showPopover = !showPopover"
      >
        {{ formatCountdown(remainingMs) }}
      </div>

      <!-- Popover -->
      <div
        v-if="showPopover"
        class="absolute top-6 left-1/2 -translate-x-1/2 z-50 w-48 bg-gray-900 border border-gray-600 rounded shadow-lg p-3 text-xs text-white"
      >
        <div v-if="data.connection.reportedBy" class="mb-1">
          <span class="text-gray-400">By:</span> {{ data.connection.reportedBy }}
        </div>
        <div class="mb-1">
          <span class="text-gray-400">At:</span>
          {{ new Date(data.connection.reportedAt).toLocaleTimeString() }}
        </div>
        <div class="mb-2">
          <span class="text-gray-400">Expires:</span>
          {{ new Date(data.connection.expiresAt).toLocaleTimeString() }}
        </div>
        <button
          class="w-full px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-xs font-medium"
          @click.stop="data.onDelete(id); showPopover = false"
        >
          Delete
        </button>
        <button
          class="w-full mt-1 px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs"
          @click.stop="showPopover = false"
        >
          Close
        </button>
      </div>
    </div>
  </EdgeLabelRenderer>
</template>
