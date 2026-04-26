<script setup lang="ts">
import { computed } from 'vue';

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
          <h2 class="text-base font-semibold">🐛 Debug Tray</h2>
          <button class="text-gray-400 hover:text-white text-xl leading-none" @click="emit('close')">&times;</button>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono">
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
</template>
