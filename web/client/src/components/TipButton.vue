<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
// @ts-ignore
import VueKofi from 'vue-kofi';
import { Z_INDEX } from '@/constants/Layers';

const isJiggling = ref(false);
const kofiColor = ref('#4338ca');
let jiggleInterval: ReturnType<typeof setInterval> | null = null;

function triggerJiggle() {
  if (localStorage.getItem('tippedNavigator')) return;
  isJiggling.value = true;
  kofiColor.value = '#4338ca';
  setTimeout(() => (kofiColor.value = '#126f9c'), 100);
  setTimeout(() => (kofiColor.value = '#4338ca'), 1600);
  setTimeout(() => (isJiggling.value = false), 2000);
}

onMounted(() => {
  triggerJiggle();
  jiggleInterval = setInterval(triggerJiggle, 60000);
});

onUnmounted(() => {
  if (jiggleInterval) clearInterval(jiggleInterval);
});

function handleKoFiClick() {
  localStorage.setItem('tippedNavigator', 'true');
  isJiggling.value = false;
}
</script>

<template>
  <div
    class="fixed bottom-4 left-4 cursor-pointer"
    :class="[Z_INDEX.UI_OVERLAY, { 'jiggle': isJiggling }]"
    @click="handleKoFiClick"
  >
    <VueKofi 
      class="kofi-button"
      uid="K3K5156KXP" 
      :color="kofiColor" 
      text="Tip the Navigator!" 
    />
  </div>
</template>

<style scoped>
@keyframes jiggle {
  0% { transform: rotate(0deg); }
  20% { transform: rotate(0deg); }
  30% { transform: rotate(-3deg); }
  40% { transform: rotate(3deg); }
  50% { transform: rotate(-3deg); }
  60% { transform: rotate(3deg); }
  80% { transform: rotate(0deg); }
  100% { transform: rotate(0deg); }
}

.jiggle {
  animation: jiggle 2s ease-in-out;
}

.kofi-button, .kofi-button :deep(*) {
  transition: background-color 1s ease-in-out, color 1s ease-in-out !important;
}
</style>
