<script setup lang="ts">
import type { NodeFeatures } from 'shared';
import ZoneCoreButton from './ZoneCoreButton.vue';

const props = defineProps<{
  features?: NodeFeatures;
  activeEditingCore: string | null;
  now: number;
  hasReds?: boolean;
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

function getTimerLabel(core: 'powercoreGreen' | 'powercoreBlue' | 'powercorePurple'): string {
  if (!props.features?.[core]) return '';
  const timerKey = core === 'powercoreGreen' ? 'powercoreTimerGreen' : core === 'powercoreBlue' ? 'powercoreTimerBlue' : 'powercoreTimerPurple';
  const expiresAt = props.features?.[timerKey as keyof NodeFeatures] as number | undefined;
  if (!expiresAt) return '';
  
  const remaining = Math.max(0, Math.floor((expiresAt - props.now) / 1000));
  if (remaining <= 0) return '';
  
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
      :label="getTimerLabel('powercoreGreen')"
      :has-reds="hasReds"
      active-ring-class="ring-green-500"
      @toggle="emit('toggle', 'powercoreGreen')"
    />
    <ZoneCoreButton 
      type="powercoreBlue"
      :active="isCoreActive('powercoreBlue')"
      :editing="activeEditingCore === 'powercoreBlue'"
      :label="getTimerLabel('powercoreBlue')"
      :has-reds="hasReds"
      active-ring-class="ring-blue-500"
      @toggle="emit('toggle', 'powercoreBlue')"
    />
    <ZoneCoreButton 
      type="powercorePurple"
      :active="isCoreActive('powercorePurple')"
      :editing="activeEditingCore === 'powercorePurple'"
      :label="getTimerLabel('powercorePurple')"
      :has-reds="hasReds"
      active-ring-class="ring-purple-500"
      @toggle="emit('toggle', 'powercorePurple')"
    />
  </div>
</template>
