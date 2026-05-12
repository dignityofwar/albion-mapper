<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { TooltipRoot, TooltipTrigger, TooltipContent, TooltipPortal } from 'reka-ui';
import { Z_INDEX } from '@/constants/Layers';

const isMounted = ref(false);
onMounted(() => { isMounted.value = true; });

const props = defineProps<{
  chest?: boolean;
  chestSize?: 'S' | 'M' | 'L';
  chestTimer?: number;
  now: number;
  hasReds: boolean;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
}>();

const isActive = computed(() => {
  if (!props.chest) return false;
  if (props.chestTimer && props.chestTimer <= props.now) return false;
  return true;
});

const timerLabel = computed(() => {
  if (!isActive.value || !props.chestTimer) return '';
  const remaining = Math.max(0, Math.floor((props.chestTimer - props.now) / 1000));
  if (remaining <= 0) return '';
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

const containerStyle = computed(() => {
  const hasContent = isActive.value && (timerLabel.value || props.chestSize);
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
  } else if (props.hasReds) {
    style.backgroundColor = `rgba(127, 29, 29, 0.7)`;
    style['--hover-bg'] = `rgba(153, 27, 27, 0.8)`;
  } else {
    style.backgroundColor = `#374151`;
    style['--hover-bg'] = '#4b5563';
  }

  return style;
});

const tooltipText = computed(() => {
  if (!isActive.value || !props.chestTimer) return 'Treasure Chest';
  const remaining = Math.max(0, Math.floor((props.chestTimer - props.now) / 1000));
  if (remaining <= 0) return 'Treasure Chest';
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const sizeLabel = props.chestSize ? ` (${props.chestSize === 'S' ? 'Small' : props.chestSize === 'M' ? 'Medium' : 'Large'})` : '';
  return `Treasure Chest${sizeLabel} (expires in ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')})`;
});
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <div
        @click.stop="emit('click')"
        class="chest-container relative group cursor-pointer overflow-visible shrink-0 rounded-tr-md rounded-br-md"
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
            <div v-if="isActive && (timerLabel || chestSize)" class="flex flex-col items-start ml-2 items-center shrink-0 overflow-hidden">
              <div v-if="timerLabel" class="text-[12px] font-bold leading-none text-slate-200">
                {{ timerLabel }}
              </div>
              <div v-if="chestSize" class="text-[12px] font-bold leading-none text-amber-300 mt-0.5">
                {{ chestSize }}
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
  width: var(--target-width, 44px);
  min-width: 44px;
  transition: width 0.3s ease, padding-right 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 44px 100%);
  padding-left: 16px;
  padding-right: 8px;
}

.chest-container.active {
  padding-right: 8px;
}

.chest-container:hover {
  background-color: var(--hover-bg) !important;
  box-shadow: inset 0 0 0 1px var(--border-color), var(--outer-shadow) !important;
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
