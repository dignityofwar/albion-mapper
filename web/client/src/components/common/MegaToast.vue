<script setup lang="ts">
defineProps<{
  visible: boolean;
  fadingOut: boolean;
  fillDuration: number; // seconds
  fillColor: string;    // e.g. 'rgba(252,165,165,0.3)'
  borderClass: string;  // e.g. 'border-red-500'
  bgClass: string;      // e.g. 'bg-red-900/40'
  enableInternalAnimation?: boolean;
}>();

defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <div
    v-if="visible"
    class="relative overflow-hidden backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl border cursor-pointer pointer-events-auto"
    :class="[bgClass, borderClass, { 'mega-toast-fading': fadingOut && (enableInternalAnimation ?? true) }]"
    @click="$emit('click')"
  >
    <div
      class="mega-toast-fill"
      :style="{ background: fillColor, animationDuration: `${fillDuration}s` }"
      :class="{ 'mega-toast-fill-paused': fadingOut && (enableInternalAnimation ?? true) }"
    ></div>
    <span class="relative text-lg md:text-2xl font-bold uppercase tracking-wider text-center block">
      <slot />
    </span>
  </div>
</template>

<style scoped>
.mega-toast-fading {
  animation: mega-toast-fade-out 0.4s ease-in forwards;
}

@keyframes mega-toast-fade-out {
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.9); }
}

.mega-toast-fill {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  width: 0%;
  animation: mega-toast-fill-anim linear forwards;
  pointer-events: none;
}

.mega-toast-fill-paused {
  animation-play-state: paused;
}

@keyframes mega-toast-fill-anim {
  0% { width: 0%; }
  100% { width: 100%; }
}
</style>
