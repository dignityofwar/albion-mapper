<script setup lang="ts">
import { computed } from 'vue';
import type { ConnectionLineProps } from '@vue-flow/core';
import { getConnectionPath } from '../../utils/connectionPath.js';
import { getHandleFacing, getDefaultHandles, getOppositeHandleId } from 'shared';

const props = defineProps<ConnectionLineProps & { isOccupied?: boolean }>();

const path = computed(() => {
  const findFacing = (node: any, handleId: string) => {
    const handles = [
      ...(node.data.customHandles || []),
      ...getDefaultHandles(node.data.type, node.data.mapShape)
    ];
    const h = handles.find(h => h.id === handleId);
    if (h) return getHandleFacing(h.left, h.top);
    return undefined;
  };

  const targetHandleId = props.targetHandle?.id || 'center';
  let tx = props.targetX;
  let ty = props.targetY;

  const sourceFacing = props.sourceHandle?.id ? findFacing(props.sourceNode, props.sourceHandle.id) : undefined;
  let targetFacing = (props.targetNode && props.targetHandle?.id) ? findFacing(props.targetNode, props.targetHandle.id) : undefined;

  if (!props.targetHandle && targetHandleId && !props.isOccupied) {
    // No handles anymore
  }

  if (props.targetHandle?.id) {
    console.log('ConnectionLine props:', {
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: tx,
      targetY: ty,
      sourcePosition: sourceFacing || props.sourcePosition,
      targetPosition: targetFacing || props.targetPosition,
      sourceHandleId: props.sourceHandle?.id,
      targetHandleId: targetHandleId,
    });
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
    forceStraight: false,
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
      :d="path"
    />
    <foreignObject
      v-if="!isOccupied && !targetHandle && !props.targetNode?.data?.mapShape"
      :x="targetX - 200"
      :y="targetY - 200"
      width="400"
      height="400"
      class="pointer-events-none"
    >
      <div class="w-full h-full flex items-center justify-center">
        <div class="w-full h-full bg-indigo-500/10 border-2 border-indigo-500/40 diamond-shape relative">
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
