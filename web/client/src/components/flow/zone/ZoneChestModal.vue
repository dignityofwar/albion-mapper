<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Z_INDEX } from '@/constants/Layers';

const props = defineProps<{
  isOpen: boolean;
  hasReds: boolean;
  chestSize?: 'S' | 'M' | 'L';
  chestTimer?: number;
  now: number;
}>();

const emit = defineEmits<{
  (e: 'save', size: 'S' | 'M' | 'L', timerValue: string): void;
  (e: 'clear'): void;
  (e: 'close'): void;
}>();

const DEFAULT_TIMERS: Record<'S' | 'M' | 'L', string> = {
  S: '05:00',
  M: '20:00',
  L: '30:00',
};

const selectedSize = ref<'S' | 'M' | 'L'>('S');
const timerValue = ref('05:00');

watch(() => props.isOpen, (open) => {
  if (open) {
    selectedSize.value = props.chestSize ?? 'S';
    if (props.chestTimer && props.chestTimer > props.now) {
      const remaining = Math.max(0, Math.floor((props.chestTimer - props.now) / 1000));
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      timerValue.value = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    } else {
      timerValue.value = DEFAULT_TIMERS[props.chestSize ?? 'S'];
    }
  }
});

watch(selectedSize, (size) => {
  timerValue.value = DEFAULT_TIMERS[size];
});

const isTimerValid = computed(() => {
  const match = timerValue.value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  return parseInt(match[2], 10) < 60;
});

function handleSave() {
  if (!isTimerValid.value) return;
  emit('save', selectedSize.value, timerValue.value);
  emit('close');
}

function handleClear() {
  emit('clear');
  emit('close');
}
</script>

<template>
  <Transition name="tray">
    <div
      v-if="isOpen"
      class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] rounded-xl shadow-2xl backdrop-blur-xl border p-4 text-left space-y-3 transition-all duration-300"
      :class="[
        hasReds ? 'bg-red-950/90 border-red-500/50' : 'bg-gray-900/95 border-gray-700',
        Z_INDEX.MODAL
      ]"
      @mousedown.stop
      @click.stop
    >
      <!-- Header -->
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-2">
          <img src="/images/chest.png" class="w-5 h-5" alt="Chest" />
          <div class="text-[10px] uppercase text-white font-bold tracking-widest">Treasure Chest</div>
        </div>
        <button
          @click="emit('close')"
          class="zone-button px-2 py-1 flex items-center gap-1.5 transition-colors"
          title="Close"
        >
          <span class="text-[10px] uppercase text-white font-bold tracking-widest">Close</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <hr class="transition-colors duration-300" :class="hasReds ? 'border-red-500/30' : 'border-gray-700/50'" />

      <!-- Size Selection -->
      <div>
        <div class="text-[9px] uppercase text-white font-bold mb-2 tracking-wider">Chest Size</div>
        <div class="flex gap-2">
          <button
            v-for="size in (['S', 'M', 'L'] as const)"
            :key="size"
            @click="selectedSize = size"
            class="flex-1 py-1.5 rounded text-xs font-bold transition-colors border"
            :class="selectedSize === size
              ? 'bg-amber-500/30 border-amber-400 text-amber-300'
              : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-400'"
          >
            {{ size === 'S' ? 'Small' : size === 'M' ? 'Medium' : 'Large' }}
          </button>
        </div>
      </div>

      <hr class="transition-colors duration-300" :class="hasReds ? 'border-red-500/30' : 'border-gray-700/50'" />

      <!-- Timer -->
      <div>
        <div class="text-[9px] uppercase text-white font-bold mb-2 tracking-wider">Respawn Timer (mm:ss)</div>
        <input
          type="text"
          v-model="timerValue"
          class="nodrag w-full bg-gray-800/80 text-white text-sm font-bold text-center border rounded px-2 py-1.5 outline-none transition-colors"
          :class="isTimerValid ? 'border-gray-600 focus:border-amber-400' : 'border-red-500 focus:border-red-400'"
          placeholder="mm:ss"
          @click.stop
          @mousedown.stop
        />
        <div v-if="!isTimerValid && timerValue" class="text-[9px] text-red-400 mt-1">Invalid format. Use mm:ss</div>
      </div>

      <hr class="transition-all duration-300" :class="hasReds ? 'border-red-500/30' : 'border-gray-700/50'" />

      <!-- Actions -->
      <div class="flex gap-2 transition-all duration-300">
        <button
          @click="handleClear"
          class="flex-1 py-1.5 rounded text-xs font-bold border bg-gray-800/50 text-gray-400 border-red-400 hover:border-ted-200 hover:bg-red-500 hover:text-white"
        >
          Clear
        </button>
        <button
          @click="handleSave"
          :disabled="!isTimerValid"
          class="flex-1 py-1.5 rounded text-xs font-bold transition-colors border"
          :class="isTimerValid
            ? 'bg-amber-500/20 border-amber-400 text-amber-300 hover:bg-amber-500/30'
            : 'bg-gray-800/30 border-gray-700 text-gray-600 cursor-not-allowed'"
        >
          Save
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.tray-enter-active,
.tray-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tray-enter-from,
.tray-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.9);
}
</style>
