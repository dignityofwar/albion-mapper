<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { CustomHandle } from 'shared';

const props = defineProps<{
  zoneName: string;
  initialHandles: CustomHandle[];
  isToggleMode?: boolean;
}>();

const emit = defineEmits<{
  (e: 'save', handles: CustomHandle[]): void;
  (e: 'close'): void;
}>();

const handles = ref<CustomHandle[]>([...props.initialHandles]);
const containerRef = ref<HTMLDivElement | null>(null);
const draggingHandleId = ref<string | null>(null);

function getPosFromT(t: number): { left: string; top: string } {
  let x, y;
  if (t < 1) {
    x = 50 + 50 * t;
    y = 50 * t;
  } else if (t < 2) {
    x = 100 - 50 * (t - 1);
    y = 50 + 50 * (t - 1);
  } else if (t < 3) {
    x = 50 - 50 * (t - 2);
    y = 100 - 50 * (t - 2);
  } else {
    x = 50 * (t - 3);
    y = 50 - 50 * (t - 3);
  }
  return { left: `${x.toFixed(2)}%`, top: `${y.toFixed(2)}%` };
}

function getTFromPos(xPercent: number, yPercent: number): number {
  // Find closest segment
  const d0 = Math.abs((xPercent - 50) - yPercent); // y = x - 50 => x - y - 50 = 0
  const d1 = Math.abs((xPercent - 100) + (yPercent - 50)); // y = 150 - x => x + y - 150 = 0
  const d2 = Math.abs((xPercent - 50) - (yPercent - 100)); // y = x + 50 => x - y + 50 = 0
  const d3 = Math.abs(xPercent + (yPercent - 50)); // y = 50 - x => x + y - 50 = 0

  const minDist = Math.min(d0, d1, d2, d3);
  
  if (minDist === d0) return Math.max(0, Math.min(1, (xPercent - 50) / 50));
  if (minDist === d1) return 1 + Math.max(0, Math.min(1, (100 - xPercent) / 50));
  if (minDist === d2) return 2 + Math.max(0, Math.min(1, (50 - xPercent) / 50));
  return 3 + Math.max(0, Math.min(1, xPercent / 50));
}

function handleEdgeClick(e: MouseEvent) {
  if (props.isToggleMode || !containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  
  const t = getTFromPos(x, y);
  const pos = getPosFromT(t);
  
  const id = `custom-${Math.random().toString(36).substr(2, 9)}`;
  handles.value.push({ id, ...pos });
}

function removeHandle(id: string, e: Event) {
  e.stopPropagation();
  if (props.isToggleMode) {
    const index = handles.value.findIndex(h => h.id === id);
    if (index !== -1) {
      handles.value[index] = { ...handles.value[index], disabled: !handles.value[index].disabled };
    }
  } else {
    handles.value = handles.value.filter(h => h.id !== id);
  }
}

function handleHandleClick(id: string, e: Event) {
  e.stopPropagation();
  if (props.isToggleMode) {
    const index = handles.value.findIndex(h => h.id === id);
    if (index !== -1) {
      handles.value[index] = { ...handles.value[index], disabled: !handles.value[index].disabled };
    }
  }
}

function startDragging(id: string, e: MouseEvent) {
  if (props.isToggleMode) return;
  e.stopPropagation();
  draggingHandleId.value = id;
}

function onMouseMove(e: MouseEvent) {
  if (!draggingHandleId.value || !containerRef.value) return;
  
  const rect = containerRef.value.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  
  const t = getTFromPos(x, y);
  const pos = getPosFromT(t);
  
  const index = handles.value.findIndex(h => h.id === draggingHandleId.value);
  if (index !== -1) {
    handles.value[index] = { ...handles.value[index], ...pos };
  }
}

function stopDragging() {
  draggingHandleId.value = null;
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', stopDragging);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', stopDragging);
});

function save() {
  emit('save', handles.value);
}
</script>

<template>
  <div class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" @click.self="emit('close')">
    <div class="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-lg w-full p-6 flex flex-col items-center">
      <h3 class="text-xl font-bold mb-2 text-white">{{ zoneName }} Handles</h3>
      <p class="text-gray-400 text-sm mb-8 text-center px-4">
        <template v-if="isToggleMode">
          Press on a dot to turn off the location of the portal.<br>
          If there is a golden "spoon" looking area like <img src="/images/spoon.jpg" class="inline-block h-5 w-auto align-middle mb-1" alt="spoon" />, don't turn it off.
        </template>
        <template v-else>
          Click on the edge of the shape to add a connection point <img src="/images/spoon.jpg" class="inline-block h-5 w-auto align-middle mb-1" alt="spoon" />.<br>
          Drag points to reposition, or double-click to remove them.
        </template>
      </p>

      <div 
        ref="containerRef"
        class="relative w-64 h-64 mb-8"
        :class="isToggleMode ? '' : 'cursor-crosshair'"
        @click="handleEdgeClick"
      >
        <!-- Diamond Shape Background -->
        <div 
          class="absolute inset-0 bg-gray-600 pointer-events-none"
          style="clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);"
        ></div>
        <div 
          class="absolute inset-[2px] bg-gray-800 pointer-events-none"
          style="clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);"
        ></div>

        <div 
          v-for="h in handles" 
          :key="h.id"
          class="absolute w-4 h-4 border-2 border-white rounded-full -ml-2 -mt-2 transition-all z-10"
          :class="[
            h.disabled ? 'bg-gray-600 opacity-50 scale-75' : 'bg-blue-500 hover:bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
            isToggleMode ? 'cursor-pointer' : 'cursor-move'
          ]"
          :style="{ left: h.left, top: h.top }"
          @mousedown="startDragging(h.id, $event)"
          @dblclick="removeHandle(h.id, $event)"
          @click="handleHandleClick(h.id, $event)"
        ></div>
      </div>

      <div class="flex gap-4 w-full">
        <button 
          class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button 
          class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded transition-colors"
          @click="save"
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
</template>
