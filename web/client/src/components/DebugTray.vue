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
  (props.edges as Array<Record<string, unknown>>).map(({ data, style: _style, ...e }) => {
    const { onDelete: _fn, ...rest } = (data ?? {}) as Record<string, unknown>;
    return { ...e, data: rest };
  }),
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
          <section>
            <h3 class="text-gray-400 uppercase tracking-wider mb-2 font-sans text-xs">Nodes ({{ debugNodes.length }})</h3>
            <pre class="bg-gray-950 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">{{ JSON.stringify(debugNodes, null, 2) }}</pre>
          </section>
          <section>
            <h3 class="text-gray-400 uppercase tracking-wider mb-2 font-sans text-xs">Edges ({{ debugEdges.length }})</h3>
            <pre class="bg-gray-950 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">{{ JSON.stringify(debugEdges, null, 2) }}</pre>
          </section>
        </div>
      </div>
    </div>
  </Transition>
</template>
