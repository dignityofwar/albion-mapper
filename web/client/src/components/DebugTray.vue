<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoomStore } from '@/stores/useRoomStore';
import { useRoomMemoryStore } from '@/stores/useRoomMemoryStore';
import { addConnection } from '@/utils/roomOperations';
import { getShapeHandlePositions } from 'shared';
import ShapeEditor from './debug/ShapeEditor.vue';
import ImportDataModal from './ImportDataModal.vue';
import { API_BASE_URL } from '@/utils/api';

const store = useRoomStore();
const memoryStore = useRoomMemoryStore();
const showShapeEditor = ref(false);
const showImportModal = ref(false);

const props = defineProps<{
  nodes: unknown[];
  edges: unknown[];
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const debugNodes = computed(() => {
  const nodes = props.nodes as Array<Record<string, unknown>>;
  const homeId = store.homeZoneId;
  const home = nodes.filter(n => n.id === homeId);
  const rest = nodes.filter(n => n.id !== homeId).sort((a, b) =>
    String(a.id ?? '').localeCompare(String(b.id ?? ''))
  );
  return [...home, ...rest];
});
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
    await addConnection(store.roomId, store.token, conn.from, conn.to, conn.minutes, 7);
  }
}

const LEGACY_FEATURE_KEYS = [
  'chest', 'chestSize', 'chestTimer',
  'resourceOre', 'resourceWood', 'resourceStone', 'resourceFibre', 'resourceLeather',
  'resourceOreSize', 'resourceWoodSize', 'resourceStoneSize', 'resourceFibreSize', 'resourceLeatherSize',
  'treasuresGreen', 'treasuresBlue', 'treasuresYellow',
  'reds',
] as const;

function flushLegacyData() {
  for (const np of store.nodePositions) {
    if (!np.features) continue;
    const f = np.features as Record<string, unknown>;
    const hasLegacy = LEGACY_FEATURE_KEYS.some(k => k in f);
    if (!hasLegacy) continue;
    const cleaned = { ...f };
    for (const k of LEGACY_FEATURE_KEYS) delete cleaned[k];
    store.updateNodeFeatures(np.zoneId, cleaned as any);
  }
  alert('Legacy feature data flushed from all nodes.');
}

async function flushMemory() {
  await fetch(`${API_BASE_URL}/api/rooms/${store.roomId}/memory`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${store.token}` },
  });
}

async function deleteZoneMemory(zoneId: string) {
  await fetch(`${API_BASE_URL}/api/rooms/${store.roomId}/memory/${encodeURIComponent(zoneId)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${store.token}` },
  });
}

function reapplyShapeHandles() {
  const nodes = props.nodes as Array<Record<string, any>>;
  let count = 0;
  for (const node of nodes) {
    const { type, mapShape } = node.data ?? {};
    if (type === 'roadsHideout') continue;
    if (!mapShape || mapShape === 'rest') continue;
    const handles = getShapeHandlePositions(mapShape);
    if (handles.length === 0) continue;
    store.updateNodeCustomHandles(node.id as string, handles);
    count++;
  }
  alert(`Re-applied shape handles to ${count} node(s).`);
}

async function exportNodes() {
  const data = JSON.stringify({
    connections: store.connections,
    homeZoneId: store.homeZoneId,
    nodePositions: store.nodePositions,
    roomHistory: Array.from(memoryStore.memory.values())
  }, null, 2);
  try {
    await navigator.clipboard.writeText(data);
    alert('Data exported to clipboard!');
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
        <div class="flex flex-col border-b border-gray-700">
          <div class="flex items-center justify-between px-4 py-3">
            <div class="flex items-center gap-3">
              <h2 class="text-base font-semibold">🐛 Debug Tray</h2>
              <span class="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs font-mono">Total Conns: {{ store.totalConnected !== null ? store.totalConnected : '…' }}</span>
            </div>
            <button class="text-gray-400 hover:text-white text-xl leading-none" @click="emit('close')">&times;</button>
          </div>
          <div class="flex flex-wrap items-center gap-2 px-4 pb-3">
            <button @click="addDemo" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs">Add Demo</button>
            <button @click="exportNodes" class="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs">Export</button>
            <button @click="showImportModal = true" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-xs">Import</button>
            <button @click="showShapeEditor = true" class="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs">Shape Editor</button>
            <button @click="flushLegacyData" class="bg-red-700 hover:bg-red-800 text-white px-2 py-1 rounded text-xs">Flush Legacy Data</button>
            <button @click="reapplyShapeHandles" class="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs">Reapply Shape Handles</button>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono">
          <details class="bg-gray-800 rounded-lg">
            <summary class="p-3 font-sans font-bold cursor-pointer">Nodes ({{ debugNodes.length }})</summary>
            <div class="p-3 space-y-2">
              <details v-for="(node, index) in debugNodes" :key="index" :class="['rounded', (node as any).id === store.homeZoneId ? 'bg-green-950' : 'bg-gray-950']">
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
          <details class="bg-gray-800 rounded-lg">
            <summary class="p-3 font-sans font-bold cursor-pointer flex items-center justify-between">
              <span>Zone Memory ({{ memoryStore.memory.size }})</span>
              <button @click.stop="flushMemory" class="bg-red-700 hover:bg-red-800 text-white px-2 py-0.5 rounded text-xs">Flush Memory</button>
            </summary>
            <div class="p-3 space-y-2">
              <div v-if="memoryStore.memory.size === 0" class="text-gray-500 text-xs p-2">No zone memory entries.</div>
              <details v-for="[zoneId, entry] in [...memoryStore.memory.entries()].sort(([a], [b]) => a === store.homeZoneId ? -1 : b === store.homeZoneId ? 1 : a.localeCompare(b))" :key="zoneId" :class="['rounded', zoneId === store.homeZoneId ? 'bg-green-950' : 'bg-gray-950']">
                <summary class="p-2 cursor-pointer flex items-center justify-between">
                  <span>{{ zoneId }} <span class="text-gray-500">(seen {{ entry.timesAdded.length }}x, updated {{ new Date(entry.lastUpdated).toLocaleString() }})</span></span>
                  <button @click.stop="deleteZoneMemory(zoneId)" class="bg-red-700 hover:bg-red-800 text-white px-2 py-0.5 rounded text-xs ml-2 shrink-0">Delete</button>
                </summary>
                <pre class="p-2 overflow-x-auto whitespace-pre-wrap break-all">{{ JSON.stringify(entry, null, 2) }}</pre>
              </details>
            </div>
          </details>
        </div>
      </div>
    </div>
  </Transition>

  <ShapeEditor v-if="showShapeEditor" @close="showShapeEditor = false" />
  <ImportDataModal v-model="showImportModal" />
</template>
