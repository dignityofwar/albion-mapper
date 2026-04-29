<script setup lang="ts">
import { computed } from 'vue';
import type { ConnectionLineProps } from '@vue-flow/core';
import { getConnectionPath } from '../../utils/connectionPath.js';
import { getHandleFacing, getDefaultHandles, DEFAULT_INTERNAL_HANDLES } from 'shared';

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

  const sourceFacing = props.sourceHandle?.id ? findFacing(props.sourceNode, props.sourceHandle.id) : undefined;
  const targetFacing = (props.targetNode && props.targetHandle?.id) ? findFacing(props.targetNode, props.targetHandle.id) : undefined;

  const [d] = getConnectionPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: sourceFacing || props.sourcePosition,
    targetPosition: targetFacing || props.targetPosition,
    sourceHandleId: props.sourceHandle?.id,
    targetHandleId: props.targetHandle?.id,
  });
  return d;
});
</script>

<template>
  <g>
    <path
      class="vue-flow__connection-path"
      fill="none"
      stroke="#6366f1"
      stroke-width="3"
      stroke-dasharray="5,5"
      :d="path"
    />
    <foreignObject
      v-if="!isOccupied"
      :x="targetX - 200"
      :y="targetY - 200"
      width="400"
      height="400"
      class="pointer-events-none"
    >
      <div class="w-full h-full flex items-center justify-center">
        <div class="w-full h-full bg-indigo-500/10 border-2 border-indigo-500/40 diamond-shape"></div>
      </div>
    </foreignObject>
  </g>
</template>

<style scoped>
.diamond-shape {
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
}
</style>
