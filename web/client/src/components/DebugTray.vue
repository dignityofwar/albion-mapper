<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoomStore } from '../stores/useRoomStore';
import { addConnection } from '../utils/roomOperations';
import ShapeEditor from './debug/ShapeEditor.vue';

const store = useRoomStore();
const showShapeEditor = ref(false);

const props = defineProps<{
  nodes: unknown[];
  edges: unknown[];
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const debugNodes = computed(() => props.nodes);
const debugEdges = computed(() =>
  (props.edges as Array<Record<string, unknown>>).map(
    ({ data, style: _style, sourceNode: _sn, targetNode: _tn, ...e }) => {
      const { onDelete: _fn, ...rest } = (data ?? {}) as Record<string, unknown>;
      return { ...e, data: rest };
    },
  ),
);

async function addDemo() {
  const demoData = [
    { from: 'touos-ataglos', to: 'qiient-in-odetum', minutes: 64 },
    { from: 'touos-ataglos', to: 'adrens-hill', minutes: 60 },
    { from: 'touos-ataglos', to: 'aspenwood', minutes: 60 },
    { from: 'qiient-in-odetum', to: 'huyes-ogozlum', minutes: 105 },
    { from: 'huyes-ogozlum', to: 'widemoor-delta', minutes: 1088 },
    { from: 'huyes-ogozlum', to: 'sandrift-fringe', minutes: 525 },
    { from: 'huyes-ogozlum', to: 'huyitos-agoitum', minutes: 686 },
    { from: 'huyitos-agoitum', to: 'whitebank-cross', minutes: 240 },
    { from: 'huyitos-agoitum', to: 'foues-aeaosum', minutes: 195 },
    { from: 'foues-aeaosum', to: 'cieitos-otatrom', minutes: 192 },
    { from: 'cieitos-otatrom', to: 'hynes-exemrom', minutes: 90 },
  ];

  for (const conn of demoData) {
    await addConnection(store.roomId, store.token, conn.from, conn.to, conn.minutes);
  }
}

async function exportNodes() {
  const data = JSON.stringify(debugNodes.value, null, 2);
  try {
    await navigator.clipboard.writeText(data);
    alert('Nodes exported to clipboard!');
  } catch (err) {
    console.error('Failed to copy!', err);
    alert('Failed to copy to clipboard.');
  }
}
</script>

<template>
  <Transition name="toast">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      @click.self="emit('close')"
    >
      <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div class="flex items-center gap-4">
            <h2 class="text-base font-semibold">🐛 Debug Tray</h2>
            <button @click="addDemo" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs">Add Demo</button>
            <button @click="exportNodes" class="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs">Export</button>
            <button @click="showShapeEditor = true" class="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs">Shape Editor</button>
            <label class="flex items-center gap-2 cursor-pointer ml-2">
              <input type="checkbox" v-model="store.showDefaultHandles" class="w-3 h-3 bg-gray-800 border-gray-700 rounded focus:ring-blue-500 text-blue-600">
              <span class="text-[10px] uppercase font-bold text-gray-400">Default Handles</span>
            </label>
          </div>
          <button class="text-gray-400 hover:text-white text-xl leading-none" @click="emit('close')">&times;</button>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono">
          <div class="bg-gray-800 rounded-lg p-3 font-sans">
            <div class="text-[10px] uppercase text-gray-500 font-bold mb-1">Room Title</div>
            <div class="text-sm font-semibold" :class="store.roomTitle ? 'text-indigo-400' : 'text-red-400'">
              {{ store.roomTitle || 'NO TITLE' }}
            </div>
          </div>
          <details class="bg-gray-800 rounded-lg">
            <summary class="p-3 font-sans font-bold cursor-pointer">Nodes ({{ debugNodes.length }})</summary>
            <div class="p-3 space-y-2">
              <details v-for="(node, index) in debugNodes" :key="index" class="bg-gray-950 rounded">
                <summary class="p-2 cursor-pointer">{{ (node as any).id || `Node ${index}` }}</summary>
                <pre class="p-2 overflow-x-auto whitespace-pre-wrap break-all">{{ JSON.stringify(node, null, 2) }}</pre>
              </details>
            </div>
          </details>
          <details class="bg-gray-800 rounded-lg">
            <summary class="p-3 font-sans font-bold cursor-pointer">Edges ({{ debugEdges.length }})</summary>
            <div class="p-3 space-y-2">
              <details v-for="(edge, index) in debugEdges" :key="index" class="bg-gray-950 rounded">
                <summary class="p-2 cursor-pointer">{{ (edge as any).source }} <-> {{ (edge as any).target }}</summary>
                <pre class="p-2 overflow-x-auto whitespace-pre-wrap break-all">{{ JSON.stringify(edge, null, 2) }}</pre>
              </details>
            </div>
          </details>
        </div>
      </div>
    </div>
  </Transition>

  <ShapeEditor v-if="showShapeEditor" @close="showShapeEditor = false" />
</template>
