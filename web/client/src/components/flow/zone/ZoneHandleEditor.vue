<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import type { CustomHandle } from 'shared';
import { useTutorialStore } from '@/stores/useTutorialStore';
import { Z_INDEX } from '@/constants/Layers';
import TutorialTooltip from '../../tutorial/TutorialTooltip.vue';

const tutorialStore = useTutorialStore();
const isModalReady = ref(false);

const props = defineProps<{
  zoneName: string;
  initialHandles: CustomHandle[];
  isToggleMode?: boolean;
  isHideout?: boolean;
}>();

const emit = defineEmits<{
  (e: 'save', handles: CustomHandle[]): void;
  (e: 'close'): void;
}>();

const handles = ref<CustomHandle[]>([...props.initialHandles]);
const containerRef = ref<HTMLDivElement | null>(null);
const saveButtonRef = ref<HTMLButtonElement | null>(null);
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
  if (draggingHandleId.value && tutorialStore.step === 4) {
    tutorialStore.setStep(5);
  }
  draggingHandleId.value = null;
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', stopDragging);
  nextTick(() => {
    isModalReady.value = true;
  });
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', stopDragging);
});

function save() {
  emit('save', handles.value);
}

function clearAll() {
  handles.value = [];
}

function rotate(degrees: number) {
  handles.value = handles.value.map(h => {
    const x = parseFloat(h.left);
    const y = parseFloat(h.top);
    const t = getTFromPos(x, y);
    
    let nextT;
    if (degrees === 90) {
      nextT = (t + 1) % 4;
    } else if (degrees === -90) {
      nextT = (t + 3) % 4;
    } else {
      return h;
    }
    
    return {
      ...h,
      ...getPosFromT(nextT)
    };
  });
}

function getHandleFacing(left: string, top: string): string {
  const l = parseFloat(left);
  const t = parseFloat(top);
  
  // Points
  if (Math.abs(l - 50) < 0.1 && Math.abs(t) < 0.1) return 'n';
  if (Math.abs(l - 100) < 0.1 && Math.abs(t - 50) < 0.1) return 'e';
  if (Math.abs(l - 50) < 0.1 && Math.abs(t - 100) < 0.1) return 's';
  if (Math.abs(l) < 0.1 && Math.abs(t - 50) < 0.1) return 'w';

  // Sides
  if (l >= 50 && t < 50) return 'ne';
  if (l > 50 && t >= 50) return 'se';
  if (l <= 50 && t > 50) return 'sw';
  return 'nw';
}
</script>

<template>
  <div class="fixed inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4" :class="Z_INDEX.MODAL" @click.self="emit('close')">
    <div class="max-w-lg w-full p-2 flex flex-col items-center relative">
      <div 
        ref="containerRef"
        class="relative w-[400px] h-[400px]"
        :class="isToggleMode ? '' : 'cursor-crosshair'"
        @click="handleEdgeClick"
      >
        <!-- Rotation Buttons - Top Left and Top Right -->
        <button 
          class="absolute top-2 left-2 w-14 h-14 z-50 bg-gray-800/90 hover:bg-gray-700 text-gray-200 rounded border border-gray-600 transition-colors flex flex-col items-center justify-center leading-none shadow-lg"
          title="Rotate Counter-Clockwise"
          @click.stop="rotate(-90)"
        >
          <span class="text-2xl">↺</span>
          <span class="text-[10px] mt-1">90°</span>
        </button>
        <button 
          class="absolute top-2 right-2 w-14 h-14 z-50 bg-gray-800/90 hover:bg-gray-700 text-gray-200 rounded border border-gray-600 transition-colors flex flex-col items-center justify-center leading-none shadow-lg"
          title="Rotate Clockwise"
          @click.stop="rotate(90)"
        >
          <span class="text-2xl">↻</span>
          <span class="text-[10px] mt-1">90°</span>
        </button>

        <!-- Center Content - Inside Diamond -->
        <div class="absolute inset-0 flex flex-col items-center justify-center z-40 pointer-events-none px-12">
          <div class="flex flex-col items-center pointer-events-auto max-w-[280px]">
            <p class="text-gray-300 text-[11px] text-center mb-4 leading-tight drop-shadow-md">
              <template v-if="isToggleMode">
                <template v-if="!isHideout">
                  Press on a dot to turn off the location of the portal.<br>
                </template>
                If there is a golden "spoon" looking area, don't turn it off.
                <div class="mt-2 flex justify-center">
                  <img src="/images/spoon.jpg" class="w-12 h-auto rounded border border-gray-600 shadow-md" alt="Spoon reference" />
                </div>
              </template>
              <template v-else>
                Click on the edge to add a connection point. Drag to reposition, or double-click to remove.
              </template>
            </p>

            <div class="relative flex gap-3 w-full mb-4 px-6">
              <button 
                class="flex-1 px-3 py-1 bg-gray-700/90 hover:bg-gray-600 text-white rounded transition-colors text-xs shadow-xl border border-gray-600"
                @click.stop="emit('close')"
              >
                Cancel
              </button>
              <button 
                ref="saveButtonRef"
                class="flex-1 px-3 py-1 bg-blue-600/90 hover:bg-blue-500 text-white font-bold rounded transition-colors text-xs shadow-xl border border-blue-500"
                @click.stop="save"
              >
                Save
              </button>
              <TutorialTooltip
                v-if="tutorialStore.step === 5 && isModalReady"
                message="Click here to save your changes."
                pointing="down"
                :style="{ position: 'absolute', bottom: '120%', right: '-20px', 'z-index': 10000 }"
              />
            </div>

            <div class="flex items-center justify-center w-full" v-if="!isToggleMode">
              <div class="flex items-center gap-2 bg-red-900/30 px-2 py-1 rounded border border-red-900/40">
                <p class="text-[9px] text-red-300 leading-tight italic">
                  Clearing points clears connections
                </p>
                <button 
                  @click.stop="clearAll" 
                  class="px-1.5 py-0.5 bg-red-900/50 hover:bg-red-900/70 text-red-100 text-[9px] rounded border border-red-800/60 transition-colors whitespace-nowrap"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
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
          class="absolute w-8 h-8 handle-arch"
          :class="[
            Z_INDEX.HANDLE,
            h.disabled ? 'is-disabled' : 'is-active',
            isToggleMode ? 'cursor-pointer' : 'cursor-move'
          ]"
          :style="{ left: h.left, top: h.top }"
          :data-facing="getHandleFacing(h.left, h.top)"
          @mousedown="startDragging(h.id, $event)"
          @dblclick="removeHandle(h.id, $event)"
          @click="handleHandleClick(h.id, $event)"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.handle-arch {
  margin-left: -16px;
  margin-top: -16px;
  background: transparent;
  transition: all 0.2s;
}

.handle-arch::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 50%;
  background-color: #3b82f6;
  border: 2px solid white;
  border-radius: 16px 16px 0 0;
  transition: all 0.2s;
}

.handle-arch.is-disabled::after {
  background-color: transparent;
  border: 3px solid #4b5563;
  opacity: 0.8;
  transform: scale(0.75);
}

.handle-arch.is-active:hover::after {
  background-color: #60a5fa;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
}

.handle-arch[data-facing="n"] { transform: rotate(0deg); }
.handle-arch[data-facing="ne"] { transform: rotate(45deg); }
.handle-arch[data-facing="e"] { transform: rotate(90deg); }
.handle-arch[data-facing="se"] { transform: rotate(135deg); }
.handle-arch[data-facing="s"] { transform: rotate(180deg); }
.handle-arch[data-facing="sw"] { transform: rotate(225deg); }
.handle-arch[data-facing="w"] { transform: rotate(270deg); }
.handle-arch[data-facing="nw"] { transform: rotate(315deg); }
</style>
