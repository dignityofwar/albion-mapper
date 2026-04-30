<script setup lang="ts">
import { computed } from 'vue';
import type { ConnectionLineProps } from '@vue-flow/core';
import { getConnectionPath } from '../../utils/connectionPath.js';
import { getHandleFacing, getDefaultHandles, DEFAULT_INTERNAL_HANDLES, getOppositeHandleId } from 'shared';

const props = defineProps<ConnectionLineProps & { isOccupied?: boolean }>();

const path = computed(() => {
  const findFacing = (node: any, handleId: string) => {
    const handles = [
      ...(node.data.customHandles || []),
      ...DEFAULT_INTERNAL_HANDLES,
      ...getDefaultHandles(node.data.mapShape)
    ];
    const h = handles.find(h => h.id === handleId);
    if (h) return getHandleFacing(h.left, h.top);
    return undefined;
  };

  const targetHandleId = props.targetHandle?.id || (!props.isOccupied ? getOppositeHandleId(props.sourceHandle?.id) : undefined);
  let tx = props.targetX;
  let ty = props.targetY;

  const sourceFacing = props.sourceHandle?.id ? findFacing(props.sourceNode, props.sourceHandle.id) : undefined;
  let targetFacing = (props.targetNode && props.targetHandle?.id) ? findFacing(props.targetNode, props.targetHandle.id) : undefined;

  if (!props.targetHandle && targetHandleId && !props.isOccupied) {
    const h = DEFAULT_INTERNAL_HANDLES.find(h => h.id === targetHandleId);
    if (h) {
      const offsetX = (parseFloat(h.left) - 50) / 100 * 400;
      const offsetY = (parseFloat(h.top) - 50) / 100 * 400;
      tx += offsetX;
      ty += offsetY;
      targetFacing = getHandleFacing(h.left, h.top);
    }
  }

  const [d] = getConnectionPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: tx,
    targetY: ty,
    sourcePosition: sourceFacing || props.sourcePosition,
    targetPosition: targetFacing || props.targetPosition,
    sourceHandleId: props.sourceHandle?.id,
    targetHandleId: targetHandleId,
  });
  return d;
});
</script>

<template>
  <g v-if="sourceHandle">
    <path
      class="vue-flow__connection-path"
      fill="none"
      stroke="#6366f1"
      stroke-width="3"
      stroke-dasharray="5,5"
      :d="path"
    />
    <foreignObject
      v-if="!isOccupied && !targetHandle"
      :x="targetX - 200"
      :y="targetY - 200"
      width="400"
      height="400"
      class="pointer-events-none"
    >
      <div class="w-full h-full flex items-center justify-center">
        <div class="w-full h-full bg-indigo-500/10 border-2 border-indigo-500/40 diamond-shape relative">
          <div v-for="h in DEFAULT_INTERNAL_HANDLES" :key="h.id"
            class="absolute w-6 h-6 rounded-full border-2 border-indigo-500/40"
            :style="{ left: h.left, top: h.top, transform: 'translate(-50%, -50%)' }"
          ></div>
        </div>
      </div>
    </foreignObject>
  </g>
</template>

<style scoped>
.diamond-shape {
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
}
</style>
