<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoomStore } from '../stores/useRoomStore.js';
import ReportForm from '../components/ReportForm.vue';
import ZoneNode from '../components/flow/ZoneNode.vue';
import ConnectionEdge from '../components/flow/ConnectionEdge.vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { radialLayout } from '../utils/radialLayout.js';
import { getConnectionStatus } from 'shared';

const props = defineProps<{ id: string }>();
const store = useRoomStore();

// ── Auth gate ────────────────────────────────────────────────────────────────
const password = ref('');
const authError = ref('');
const authenticating = ref(false);
const isAuthenticated = ref(false);
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

onMounted(async () => {
  // Check session storage for a pre-existing token (from create flow)
  const stored = sessionStorage.getItem(`token:${props.id}`);
  const shareUrl = sessionStorage.getItem(`shareUrl:${props.id}`);
  if (stored) {
    store.setCredentials(props.id, stored);
    isAuthenticated.value = true;
    store.connect();
    if (shareUrl) {
      showToast(`Share URL: ${shareUrl}`);
      sessionStorage.removeItem(`shareUrl:${props.id}`);
    }
  }
});

async function authenticate() {
  if (!password.value) return;
  authenticating.value = true;
  authError.value = '';
  try {
    const res = await fetch(`/api/rooms/${props.id}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value }),
    });
    if (!res.ok) {
      authError.value = 'Invalid password';
      return;
    }
    const { token } = await res.json() as { token: string };
    sessionStorage.setItem(`token:${props.id}`, token);
    store.setCredentials(props.id, token);
    isAuthenticated.value = true;
    store.connect();
  } finally {
    authenticating.value = false;
  }
}

// ── Toast ────────────────────────────────────────────────────────────────────
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

function formatTime(d: Date): string {
  const day   = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' }); // "Apr", "Jan", …
  const hh    = String(d.getHours()).padStart(2, '0');
  const mm    = String(d.getMinutes()).padStart(2, '0');
  const ss    = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month} ${hh}:${mm}:${ss}`;
}

// ── Vue Flow nodes/edges ──────────────────────────────────────────────────────
const { fitView } = useVueFlow();

const nodes = computed(() => {
  const conns = store.connections.filter(
    (c) => getConnectionStatus(c, new Date(now.value)) !== 'expired',
  );
  const positions = radialLayout(store.homeZoneId, conns);
  return positions.map((p) => ({
    id: p.id,
    type: 'zone',
    position: { x: p.x, y: p.y },
    data: { isHome: p.id === store.homeZoneId },
  }));
});

const edges = computed(() => {
  const conns = store.connections.filter(
    (c) => getConnectionStatus(c, new Date(now.value)) !== 'expired',
  );
  return conns.map((c) => ({
    id: c.id,
    type: 'connection',
    source: c.fromZoneId,
    target: c.toZoneId,
    data: {
      connection: c,
      now: now.value,
      onDelete: deleteConnection,
    },
  }));
});

// ── Actions ──────────────────────────────────────────────────────────────────
async function setHomeZone(zoneId: string) {
  if (zoneId === store.homeZoneId) return;
  await fetch(`/api/rooms/${props.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${store.token}`,
    },
    body: JSON.stringify({ homeZoneId: zoneId }),
  });
}

async function deleteConnection(connectionId: string) {
  await fetch(`/api/rooms/${props.id}/connections/${connectionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${store.token}` },
  });
}
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-950 text-white">
    <!-- Auth gate -->
    <div
      v-if="!isAuthenticated"
      class="flex-1 flex items-center justify-center p-6"
    >
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
        <h2 class="text-xl font-semibold mb-4">Enter Room Password</h2>
        <p class="text-gray-400 text-sm mb-4">Room: <code class="text-indigo-300">{{ id }}</code></p>
        <input
          v-model="password"
          type="password"
          placeholder="Password"
          class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white outline-none mb-3"
          @keydown.enter="authenticate"
        />
        <p v-if="authError" class="text-red-400 text-sm mb-3">{{ authError }}</p>
        <button
          :disabled="!password || authenticating"
          class="w-full px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 font-medium disabled:opacity-50"
          @click="authenticate"
        >
          {{ authenticating ? 'Authenticating…' : 'Enter' }}
        </button>
      </div>
    </div>

    <!-- Main mapper -->
    <template v-else>
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
          :edge-types="{ connection: ConnectionEdge }"
          :fit-view-on-init="true"
          class="bg-gray-950"
          @node-click="(e) => setHomeZone(e.node.id)"
        >
          <Background />
          <Controls />
        </VueFlow>
      </div>
    </template>

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
