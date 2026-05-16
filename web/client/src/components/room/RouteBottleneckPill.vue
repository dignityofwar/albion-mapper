<script setup lang="ts">
import { Z_INDEX } from '@/constants/Layers';
import { formatCountdown } from '@/utils/formatters';

defineProps<{ ms: number }>();
</script>

<template>
  <div
    class="absolute top-28 md:top-14 left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-1.5 px-3 py-1 rounded-full text-md font-medium backdrop-blur-sm"
    :class="[
      Z_INDEX.TOAST,
      ms <= 0
        ? 'route-pill-expired'
        : ms < 30 * 60 * 1000
          ? 'route-pill-red'
          : ms < 60 * 60 * 1000
            ? 'route-pill-orange'
            : 'route-pill-blue'
    ]"
  >
    <span>⏱</span>
    <span>Route open for: {{ ms <= 0 ? 'Expired' : formatCountdown(ms) }}</span>
  </div>
</template>

<style scoped>
/* Route bottleneck pill styles — mirrors connectionStyle.ts */
.route-pill-blue {
  border: 2px solid #3b82f6;
  color: #bfdbfe;
  background: rgba(29, 78, 216, 0.7);
}

.route-pill-green {
  border: 2px solid #0ee25e;
  color: #0ee25e;
  background: rgba(3, 140, 54, 0.7);
}

.route-pill-orange {
  border: 2px dashed #f59e0b;
  color: #f59e0b;
  background: rgba(172, 105, 0, 0.7);
  animation: route-pill-pulse 0.9s ease-in-out infinite;
}

.route-pill-red {
  border: 2px dotted #ef4444;
  color: #ef4444;
  background: rgba(163, 0, 0, 0.7);
  animation: route-pill-pulse 0.5s ease-in-out infinite;
}

.route-pill-expired {
  border: 2px dotted #acadae;
  color: #acadae;
  background: rgba(30, 30, 30, 0.7);
}

@keyframes route-pill-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
</style>
