<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '../stores/useRoomStore.js';
import ReportForm from '../components/ReportForm.vue';
import ZoneNode from '../components/flow/ZoneNode.vue';
import DebugTray from '../components/DebugTray.vue';
import RoomSettings from '../components/RoomSettings.vue';
import { VueFlow, useVueFlow, ConnectionMode } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { radialLayout } from '../utils/radialLayout.js';
import { getConnectionStatus } from 'shared';
import { connectionStyle } from '../utils/connectionStyle.js';
import { formatTime, formatExpiresIn } from '../utils/formatters.js';
import { setHomeZone, deleteConnection } from '../utils/roomOperations.js';

const props = defineProps<{ id: string }>();
const store = useRoomStore();
const router = useRouter();

// ── Toast ────────────────────────────────────────────────────────────────────
const toast = ref('');
const lastUpdateFlash = ref(false);
let flashTimeout: ReturnType<typeof setTimeout> | null = null;

// Flash animation whenever lastUpdate changes
watch(
  () => store.lastUpdate,
  () => {
    lastUpdateFlash.value = false;
    if (flashTimeout) clearTimeout(flashTimeout);
    // micro-tick to reset then re-enable
    requestAnimationFrame(() => {
      lastUpdateFlash.value = true;
      flashTimeout = setTimeout(() => (lastUpdateFlash.value = false), 2000);
    });
  },
);

onMounted(() => {
  const stored = sessionStorage.getItem(`token:${props.id}`);
  if (!stored) {
    router.replace({ path: `/rooms/${props.id}/auth` });
    return;
  }
  store.setCredentials(props.id, stored);
  store.connect();
  const shareUrl = sessionStorage.getItem(`shareUrl:${props.id}`);
  if (shareUrl) {
    showToast(`Share URL: ${shareUrl}`);
    sessionStorage.removeItem(`shareUrl:${props.id}`);
  }
});

// ── Toast (kept below) ───────────────────────────────────────────────────────
let toastTimeout: ReturnType<typeof setTimeout> | null = null;
function showToast(msg: string) {
  toast.value = msg;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => (toast.value = ''), 5000);
}

// ── Countdown ticker ─────────────────────────────────────────────────────────
const now = ref(Date.now());
const ticker = setInterval(() => (now.value = Date.now()), 1000);
onUnmounted(() => {
  clearInterval(ticker);
  store.disconnect();
  if (toastTimeout) clearTimeout(toastTimeout);
  if (flashTimeout) clearTimeout(flashTimeout);
});


// ── Vue Flow nodes/edges ──────────────────────────────────────────────────────
const { fitView } = useVueFlow();

const nodes = computed(() => {
  const conns = store.connections.filter(
    (c) => getConnectionStatus(c, new Date(now.value)) !== 'expired',
  );
  const positions = radialLayout(store.homeZoneId, conns);
  return positions.map((p) => {
    const isHome = p.id === store.homeZoneId;
    return {
      id: p.id,
      type: 'zone',
      position: { x: p.x, y: p.y },
      // All nodes are the same visual size: w-40 h-20 = 160×80px
      width: 160,
      height: 80,
      data: { isHome },
    };
  });
});

// Re-fit the view whenever the set of nodes changes (e.g. after WS sync)
watch(
  () => nodes.value.length,
  async () => {
    await nextTick();
    fitView({ padding: 0.2, duration: 300 });
  },
);



const edges = computed(() => {
  const conns = store.connections.filter(
    (c) => getConnectionStatus(c, new Date(now.value)) !== 'expired',
  );
  return conns.map((c) => {
    const remainingMs = new Date(c.expiresAt).getTime() - now.value;
    const isStale = remainingMs < 0 && remainingMs > -6 * 60 * 60 * 1000;
    const style = connectionStyle(remainingMs, isStale);
    return {
      id: c.id,
      type: 'default',
      source: c.fromZoneId,
      target: c.toZoneId,
      animated: style.animated,
      label: formatExpiresIn(remainingMs),
      style: { stroke: style.stroke, strokeDasharray: style.strokeDasharray, strokeWidth: 2 },
      labelStyle: { fill: '#fff', fontSize: 11 },
      labelBgStyle: { fill: '#111827', fillOpacity: 0.8 },
      data: { connection: c, onDelete: handleDeleteConnection },
    };
  });
});

// ── Debug tray ───────────────────────────────────────────────────────────────
const showDebug = ref(false);

// ── Actions ──────────────────────────────────────────────────────────────────
function handleSetHomeZone(zoneId: string) {
  if (zoneId === store.homeZoneId) return;
  setHomeZone(props.id, store.token!, zoneId);
}

function handleDeleteConnection(connectionId: string) {
  deleteConnection(props.id, store.token!, connectionId);
}
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-950 text-white">
    <!-- Sticky report panel -->
    <div class="shrink-0">
      <ReportForm @success="showToast" />
    </div>

    <!-- WS status bar (always visible) -->
    <div class="shrink-0 px-3 py-1 text-xs flex items-center justify-center" :class="store.wsStatus === 'connected' ? 'bg-green-900 text-green-300' : store.wsStatus === 'connecting' ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'">
      <span v-if="store.wsStatus === 'connected'">
        ● Connected – Last update
        <span
          class="status-update-time"
          :class="{ 'status-update-flash': lastUpdateFlash }"
        >{{ store.lastUpdate ? formatTime(store.lastUpdate) : '…' }}</span>
      </span>
      <span v-else-if="store.wsStatus === 'connecting'">⟳ Connecting…</span>
      <span v-else>⚠ Disconnected — reconnecting…</span>
    </div>

    <!-- Graph -->
    <div class="flex-1 relative">
      <VueFlow
        :nodes="nodes"
        :edges="edges"
        :node-types="{ zone: ZoneNode }"
        :fit-view-on-init="true"
        :connection-mode="ConnectionMode.Loose"
        class="bg-gray-950"
        @node-click="(e) => handleSetHomeZone(e.node.id)"
      >
        <Background />
        <Controls />
      </VueFlow>
    </div>

    <!-- Debug tray button -->
    <button
      class="fixed bottom-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 border border-gray-600 hover:bg-gray-700 text-lg shadow-lg"
      title="Debug tray"
      @click="showDebug = true"
    >🐛</button>

    <!-- Debug tray modal -->
    <DebugTray :nodes="nodes" :edges="edges" :show="showDebug" @close="showDebug = false" />

    <!-- Settings (cog + modal with log out) -->
    <RoomSettings :room-id="id" />

    <!-- Toast -->
    <Transition name="toast">
      <div
        v-if="toast"
        class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-sm text-white shadow-lg"
      >
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(1rem);
}

/* Status bar: "Last update" time flash */
.status-update-time {
  display: inline-block;
  padding: 0 4px;
  border-radius: 3px;
  position: relative;
}

/* White background that fades to transparent */
.status-update-time::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 3px;
  background: white;
  opacity: 0;
  pointer-events: none;
}

.status-update-flash::after {
  animation: update-flash 2s ease-out forwards;
}

@keyframes update-flash {
  0%   { opacity: 0.85; }
  15%  { opacity: 0.85; }
  100% { opacity: 0; }
}
</style>
