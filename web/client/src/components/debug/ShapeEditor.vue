<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

interface DebugHandle {
  id: string;
  left: string;
  top: string;
}

const handles = ref<DebugHandle[]>([]);
const selectedShape = ref('c');
const shapes = ['c', 'f', 'h', 'o', 'p', 's', 't', 'x', 'rest'];
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
  const d0 = Math.abs((xPercent - 50) - yPercent);
  const d1 = Math.abs((xPercent - 100) + (yPercent - 50));
  const d2 = Math.abs((xPercent - 50) - (yPercent - 100));
  const d3 = Math.abs(xPercent + (yPercent - 50));

  const minDist = Math.min(d0, d1, d2, d3);
  
  if (minDist === d0) return Math.max(0, Math.min(1, (xPercent - 50) / 50));
  if (minDist === d1) return 1 + Math.max(0, Math.min(1, (100 - xPercent) / 50));
  if (minDist === d2) return 2 + Math.max(0, Math.min(1, (50 - xPercent) / 50));
  return 3 + Math.max(0, Math.min(1, xPercent / 50));
}

function handleEdgeClick(e: MouseEvent) {
  if (!containerRef.value) return;
  if ((e.target as HTMLElement).closest('.handle')) return;

  const rect = containerRef.value.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  
  const t = getTFromPos(x, y);
  const pos = getPosFromT(t);
  
  const id = `${selectedShape.value}-p${handles.value.length + 1}`;
  handles.value.push({ id, ...pos });
}

function removeHandle(id: string, e: Event) {
  e.stopPropagation();
  handles.value = handles.value.filter(h => h.id !== id);
}

function startDragging(id: string, e: MouseEvent) {
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

const outputCode = computed(() => {
  if (handles.value.length === 0) return "// Click on the diamond to add points";
  
  const points = handles.value.map(h => {
    return `      { id: '${h.id}', left: '${h.left}', top: '${h.top}' },`;
  }).join('\n');

  return `  if (shape === '${selectedShape.value}') {
    return [
${points}
    ];
  }`;
});

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(outputCode.value);
    alert('Copied to clipboard!');
  } catch (err) {
    alert('Failed to copy');
  }
}

function clearAll() {
  handles.value = [];
}
</script>

<template>
  <div class="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" @click.self="emit('close')">
    <div class="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-2xl w-full p-6 flex flex-col items-center">
      <div class="w-full flex justify-between items-center mb-6">
        <h3 class="text-xl font-bold text-white">Road Shape Editor</h3>
        <button class="text-gray-400 hover:text-white text-2xl" @click="emit('close')">&times;</button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        <div class="flex flex-col items-center">
          <div class="w-full flex gap-2 mb-4">
            <div class="flex-1">
              <label class="block text-[10px] text-gray-500 uppercase font-bold mb-1">Target Shape</label>
              <select 
                v-model="selectedShape"
                class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                @change="clearAll"
              >
                <option v-for="s in shapes" :key="s" :value="s">{{ s.toUpperCase() }}</option>
              </select>
            </div>
            <div class="flex items-end">
              <button @click="clearAll" class="px-3 py-1 bg-red-900/50 hover:bg-red-900 text-red-200 text-xs rounded border border-red-700 h-[30px]">Clear</button>
            </div>
          </div>

          <div 
            ref="containerRef"
            class="relative w-64 h-64 mb-4 cursor-crosshair group"
            @click="handleEdgeClick"
          >
            <!-- Diamond Shape Background -->
            <div 
              class="absolute inset-0 bg-gray-700 pointer-events-none group-hover:bg-gray-600 transition-colors"
              style="clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);"
            ></div>
            <div 
              class="absolute inset-[2px] bg-gray-800 pointer-events-none"
              style="clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);"
            ></div>

            <div 
              v-for="h in handles" 
              :key="h.id"
              class="handle absolute w-4 h-4 bg-yellow-500 border-2 border-white rounded-full -ml-2 -mt-2 cursor-move z-10 shadow-[0_0_8px_rgba(234,179,8,0.5)] hover:scale-110 transition-transform"
              :style="{ left: h.left, top: h.top }"
              @mousedown="startDragging(h.id, $event)"
              @dblclick="removeHandle(h.id, $event)"
            >
              <div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-[10px] px-1 rounded text-white whitespace-nowrap pointer-events-none">
                {{ h.id }}
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col h-full">
          <div class="text-sm font-semibold text-gray-400 mb-2">Output Datagram:</div>
          <div class="relative flex-1 min-h-[200px]">
            <textarea 
              readonly
              class="w-full h-full bg-black rounded p-3 text-xs font-mono text-green-400 border border-gray-700 resize-none focus:outline-none"
              :value="outputCode"
            ></textarea>
            <button 
              @click="copyToClipboard"
              class="absolute top-2 right-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-2 py-1 rounded shadow-lg transition-colors"
            >
              Copy
            </button>
          </div>
          <p class="text-[10px] text-gray-500 mt-2 italic">
            Double-click points to remove them.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
