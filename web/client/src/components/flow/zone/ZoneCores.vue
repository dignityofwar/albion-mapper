<script setup lang="ts">
import type { NodeFeatures } from 'shared';
import ZoneCoreButton from './ZoneCoreButton.vue';
import { ref, computed } from 'vue';
import { Z_INDEX } from '@/constants/Layers';

const props = defineProps<{
  features?: NodeFeatures;
  activeEditingCore: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | 'powercoreYellow' | null;
  now: number;
  hasReds?: boolean;
  timerValue: string;
  isTimerTooLong: boolean;
  isTimerValid: boolean;
  cores?: ('powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | 'powercoreYellow')[];
  side?: 'left' | 'right';
}>();

const emit = defineEmits<{ 
  (e: 'toggle', core: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | 'powercoreYellow'): void;
  (e: 'update:timerValue', value: string): void;
  (e: 'save'): void;
  (e: 'clear'): void;
  (e: 'focus'): void;
  (e: 'blur'): void;
  (e: 'unlock', core: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | 'powercoreYellow'): void;
  (e: 'lock', core: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | 'powercoreYellow'): void;
}>();

function isCoreActive(core: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | 'powercoreYellow'): boolean {
  return !!props.features?.[core];
}

function isCoreUnlocked(core: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | 'powercoreYellow'): boolean {
  if (!props.features?.[core]) return false;
  const timerKey = core === 'powercoreGreen' ? 'powercoreTimerGreen' : core === 'powercoreBlue' ? 'powercoreTimerBlue' : core === 'powercorePurple' ? 'powercoreTimerPurple' : 'powercoreTimerYellow';
  const expiresAt = props.features?.[timerKey as keyof NodeFeatures] as number | undefined;
  
  if (!expiresAt) return true;
  return expiresAt <= props.now;
}

function getTimerLabel(core: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple' | 'powercoreYellow'): string {
  if (!props.features?.[core]) return '';
  const timerKey = core === 'powercoreGreen' ? 'powercoreTimerGreen' : core === 'powercoreBlue' ? 'powercoreTimerBlue' : core === 'powercorePurple' ? 'powercoreTimerPurple' : 'powercoreTimerYellow';
  const expiresAt = props.features?.[timerKey as keyof NodeFeatures] as number | undefined;
  if (!expiresAt) return '';
  
  const remaining = Math.max(0, Math.floor((expiresAt - props.now) / 1000));
  if (remaining <= 0) return '';
  
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const coreButtonRefs = ref<Record<string, any>>({});

const coresToDisplay = computed(() => props.cores || (['powercoreGreen', 'powercoreBlue', 'powercorePurple', 'powercoreYellow'] as const));

defineExpose({
  focus: () => {
    if (props.activeEditingCore) {
      coreButtonRefs.value[props.activeEditingCore]?.focus();
    }
  },
  blur: () => {
    if (props.activeEditingCore) {
      coreButtonRefs.value[props.activeEditingCore]?.blur();
    }
  },
});
</script>

<template>
  <div class="relative w-12 h-[80px]">
    <div 
      v-for="(core, index) in coresToDisplay" 
      :key="core"
      class="absolute flex items-center"
      :class="[
        side === 'right' ? 'right-0' : 'left-0',
        (isCoreActive(core) && activeEditingCore === core) ? Z_INDEX.UI_OVERLAY : Z_INDEX.CONTENT_LOW
      ]"
      :style="{ top: `${index * 36}px`, [side === 'right' ? 'right' : 'left']: `${index * -36}px` }"
    >
      <ZoneCoreButton 
        :ref="el => { if (el) coreButtonRefs[core] = el }"
        :type="core"
        :active="isCoreActive(core)"
        :editing="activeEditingCore === core"
        :label="getTimerLabel(core)"
        :has-reds="hasReds"
        :timer-value="activeEditingCore === core ? timerValue : ''"
        :is-timer-too-long="activeEditingCore === core ? isTimerTooLong : false"
        :is-timer-valid="activeEditingCore === core ? isTimerValid : false"
        :is-unlocked="isCoreUnlocked(core)"
        :side="side"
        @toggle="emit('toggle', core)"
        @update:timer-value="emit('update:timerValue', $event)"
        @save="emit('save')"
        @clear="emit('clear')"
        @focus="emit('focus')"
        @blur="emit('blur')"
        @unlock="emit('unlock', core)"
        @lock="emit('lock', core)"
      />
    </div>
  </div>
</template>
