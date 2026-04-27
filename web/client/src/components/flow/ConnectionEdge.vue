<script setup lang="ts">
import { computed, ref, watch, onUnmounted, nextTick, inject, type Ref } from 'vue';
import { BaseEdge, EdgeLabelRenderer, getStraightPath } from '@vue-flow/core';
import type { EdgeProps } from '@vue-flow/core';
import { connectionStyle } from '../../utils/connectionStyle.js';
import { formatCountdown } from '../../utils/formatters.js';
import TimeInput from '../common/TimeInput.vue';
import { ZONE_BY_ID, type Connection } from 'shared';

type EdgeData = {
  connection: Connection;
  now: number; // epoch ms, updated by parent interval
  onDelete: (id: string) => void;
  onUpdate: (id: string, minutesRemaining: number) => void;
};

const props = defineProps<EdgeProps<EdgeData>>();

const showPopover = ref(false);
const popoverRef = ref<HTMLElement | null>(null);
const newMinutesRemaining = ref<number | null>(null);

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
    newMinutesRemaining.value = null;
    nextTick(() => {
      document.addEventListener('click', closePopover);
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
const isStale = computed(() => remainingMs.value < 0 && remainingMs.value > -6 * 60 * 60 * 1000);
const isExpired = computed(() => props.data.connection.isExpired ?? false);

const style = computed(() => connectionStyle(remainingMs.value, isStale.value, isExpired.value));

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

</script>

<template>
  <BaseEdge
    :id="id"
    :path="path"
    :animated="style.animated"
    :class="{ 'animated': style.animated }"
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
      class="absolute nodrag nopan z-[5000]"
    >
      <!-- Countdown label -->
      <div
        data-trigger="true"
        class="text-xs px-3 py-1.5 rounded-full text-white cursor-pointer shadow-sm"
        :style="{ backgroundColor: style.color, border: `1px solid ${style.stroke}` }"
        @click="showPopover = !showPopover"
      >
        {{ formatCountdown(remainingMs) }}
      </div>

      <!-- Popover -->
      <div
        v-if="showPopover"
        ref="popoverRef"
        class="absolute top-6 left-1/2 -translate-x-1/2 z-[6000] w-48 bg-gray-900 border border-gray-600 rounded shadow-lg p-3 text-xs text-white"
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
          <div class="mt-2">
            <TimeInput v-model="newMinutesRemaining" />
            <button
              :disabled="newMinutesRemaining === null"
              class="w-full mt-2 px-3 py-2 rounded bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-medium disabled:opacity-50"
              @click.stop="data.onUpdate(id, newMinutesRemaining!); showPopover = false"
            >
              Update
            </button>
          </div>
        </div>
        <button
          class="w-full px-3 py-2 rounded bg-red-700 hover:bg-red-600 text-white text-xs font-medium"
          @click.stop="data.onDelete(id); showPopover = false"
        >
          Delete
        </button>
      </div>
    </div>
  </EdgeLabelRenderer>
</template>

<style scoped>
.animated .vue-flow__edge-path {
  animation: dash 1s linear infinite;
}

@keyframes dash {
  to {
    stroke-dashoffset: -9;
  }
}
</style>
