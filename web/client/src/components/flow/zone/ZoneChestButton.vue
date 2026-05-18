<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { TooltipRoot, TooltipTrigger, TooltipContent, TooltipPortal } from 'reka-ui';
import { Z_INDEX } from '@/constants/Layers';
import type { TimedChest } from 'shared';

const isMounted = ref(false);
onMounted(() => { isMounted.value = true; });

const props = defineProps<{
  timedChest?: TimedChest;
  now: number;
  hasReds: boolean;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
}>();

const isActive = computed(() => {
  if (!props.timedChest) return false;
  if (props.timedChest.timer <= props.now) return false;
  return true;
});

const timerLabel = computed(() => {
  if (!isActive.value || !props.timedChest) return '';
  const remaining = Math.max(0, Math.floor((props.timedChest.timer - props.now) / 1000));
  if (remaining <= 0) return '';
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
})

const containerStyle = computed(() => {
  const hasContent = isActive.value && (timerLabel.value || props.timedChest?.size);
  const targetWidth = hasContent ? '110px' : '80px';
  const color = '#f59e0b';
  const shadow = 'rgba(245, 158, 11, 0.5)';

  const style: any = {
    width: targetWidth,
    '--target-width': targetWidth,
    '--border-color': color,
    '--outer-shadow': `0 4px 10px -2px ${shadow}`,
  };

  if (isActive.value) {
    style.backgroundColor = `rgba(245, 158, 11, 0.2)`;
    style.boxShadow = `inset 0 0 0 1px ${color}, 0 4px 10px -2px ${shadow}`;
    style['--hover-bg'] = `rgba(245, 158, 11, 0.35)`;
    style.backdropFilter = 'blur(8px)';
  } else if (props.hasReds) {
    style.backgroundColor = `rgba(127, 29, 29, 0.6)`;
    style['--hover-bg'] = `rgba(153, 27, 27, 0.7)`;
  } else {
    style.backgroundColor = `rgba(55, 65, 81, 0.8)`;
    style['--hover-bg'] = 'rgba(75, 85, 99, 0.8)';
  }

  return style;
});

const tooltipText = computed(() => {
  if (!isActive.value || !props.timedChest) return 'Treasure Chest';
  const remaining = Math.max(0, Math.floor((props.timedChest.timer - props.now) / 1000));
  if (remaining <= 0) return 'Treasure Chest';
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const size = props.timedChest.size;
  const sizeLabel = size ? ` (${size === 'S' ? 'Small' : size === 'M' ? 'Medium' : 'Large'})` : '';
  return `Treasure Chest${sizeLabel} (expires in ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')})`;
});
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <div
        @click.stop="emit('click')"
        class="chest-container slide-button relative group rounded-tr-md rounded-br-md"
        :class="[
          { 'active': isActive },
          Z_INDEX.CONTENT_HIGH
        ]"
        :style="containerStyle"
      >
        <div class="flex items-center justify-start h-full pl-6 relative z-10">
          <!-- Left Div: Logo -->
          <div class="shrink-0 flex items-center justify-center">
            <img src="/images/chest.png" class="w-6 h-6 p-[2px]" alt="Chest" />
          </div>

          <!-- Right Div: Timer and Size -->
          <Transition name="fade-slide">
            <div v-if="isActive && (timerLabel || timedChest?.size)" class="flex flex-col items-start ml-2 items-center shrink-0 overflow-hidden">
              <div v-if="timerLabel" class="text-[12px] font-bold leading-none text-slate-200">
                {{ timerLabel }}
              </div>
              <div v-if="timedChest?.size" class="text-[12px] font-bold leading-none text-amber-300 mt-0.5">
                {{ timedChest.size }}
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        class="bg-black text-white text-xs px-2 py-1 rounded shadow-lg z-50 side-top animate-in fade-in zoom-in duration-200"
        :side-offset="5"
      >
        {{ tooltipText }}
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>

<style scoped>
.chest-container {
  height: 44px;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 44px 100%);
  padding-left: 16px;
  padding-right: 8px;
}

.chest-container.active {
  padding-right: 8px;
}


.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
