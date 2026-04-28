<script setup lang="ts">
import type { NodeFeatures } from 'shared';
import ZoneCoreButton from './ZoneCoreButton.vue';

const props = defineProps<{
  features?: NodeFeatures;
  activeEditingCore: string | null;
  now: number;
}>();

const emit = defineEmits<{
  (e: 'toggle', core: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple'): void;
}>();

function isCoreActive(core: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple'): boolean {
  if (!props.features?.[core]) return false;
  const timerKey = core === 'powercoreGreen' ? 'powercoreTimerGreen' : core === 'powercoreBlue' ? 'powercoreTimerBlue' : 'powercoreTimerPurple';
  const expiresAt = props.features?.[timerKey as keyof NodeFeatures] as number | undefined;
  if (!expiresAt) return true;
  return expiresAt > props.now;
}

function getTimerLabel(core: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple'): string | undefined {
  const timerKey = core === 'powercoreGreen' ? 'powercoreTimerGreen' : core === 'powercoreBlue' ? 'powercoreTimerBlue' : 'powercoreTimerPurple';
  const expiresAtMs = props.features?.[timerKey as keyof NodeFeatures] as number | undefined;
  if (expiresAtMs === undefined || expiresAtMs === null) return undefined;
  
  const remaining = Math.max(0, Math.floor((expiresAtMs - props.now) / 1000));
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
</script>

<template>
  <div class="flex items-center justify-center gap-1.5">
    <ZoneCoreButton 
      type="powercoreGreen"
      :active="isCoreActive('powercoreGreen')"
      :editing="activeEditingCore === 'powercoreGreen'"
      :timer-label="getTimerLabel('powercoreGreen')"
      @toggle="emit('toggle', 'powercoreGreen')"
    />
    <ZoneCoreButton 
      type="powercoreBlue"
      :active="isCoreActive('powercoreBlue')"
      :editing="activeEditingCore === 'powercoreBlue'"
      :timer-label="getTimerLabel('powercoreBlue')"
      @toggle="emit('toggle', 'powercoreBlue')"
    />
    <ZoneCoreButton 
      type="powercorePurple"
      :active="isCoreActive('powercorePurple')"
      :editing="activeEditingCore === 'powercorePurple'"
      :timer-label="getTimerLabel('powercorePurple')"
      @toggle="emit('toggle', 'powercorePurple')"
    />
  </div>
</template>
