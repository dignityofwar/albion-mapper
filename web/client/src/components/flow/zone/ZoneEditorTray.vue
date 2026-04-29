<script setup lang="ts">
import { NodeFeatures } from 'shared';
import ZoneFeatureToggle from './ZoneFeatureToggle.vue';

defineProps<{
  isOpen: boolean;
  hasReds: boolean;
  features?: NodeFeatures;
}>();

const emit = defineEmits<{
  (e: 'toggle', feature: any): void;
  (e: 'close'): void;
}>();
</script>

<template>
  <Transition name="tray">
    <div v-if="isOpen" 
      class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[240px] rounded-xl shadow-2xl backdrop-blur-xl border p-4 text-left space-y-3 transition-all duration-300"
      :class="hasReds ? 'bg-red-950/90 border-red-500/50' : 'bg-gray-900/95 border-gray-700'"
      @mousedown.stop
      @click.stop
    >
      <div class="flex items-center justify-between mb-1">
        <div class="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Edit Map Features</div>
        <button 
          @click="emit('close')"
          class="p-0.5 rounded-full hover:bg-white/10 text-gray-500 transition-colors"
          title="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <hr class="transition-colors duration-300" :class="hasReds ? 'border-red-500/30' : 'border-gray-700/50'" />

      <!-- Chests -->
      <div>
        <div class="text-[9px] uppercase text-gray-500 font-bold mb-1.5 tracking-wider" title="Chests">Chests</div>
        <div class="flex flex-wrap gap-1.5 justify-start">
          <ZoneFeatureToggle 
            v-for="f in [
              { type: 'chest', title: 'Chests' },
              { type: 'treasuresGreen', title: 'Green Treasures' },
              { type: 'treasuresBlue', title: 'Blue Treasures' },
              { type: 'treasuresYellow', title: 'Yellow Treasures' }
            ]"
            :key="f.type"
            :type="f.type as any"
            :active="!!features?.[f.type as keyof NodeFeatures]"
            :has-reds="hasReds"
            :title="f.title"
            @toggle="emit('toggle', f.type as any)"
          />
        </div>
      </div>
      
      <hr class="transition-colors duration-300" :class="hasReds ? 'border-red-500/30' : 'border-gray-700/50'" />

      <!-- Resources -->
      <div>
        <div class="text-[9px] uppercase text-gray-500 font-bold mb-1.5 tracking-wider" title="Resources">Resources</div>
        <div class="flex flex-wrap gap-1.5 justify-start">
          <ZoneFeatureToggle 
            v-for="f in [
              { type: 'resourceFibre', title: 'Fibre' },
              { type: 'resourceLeather', title: 'Leather' },
              { type: 'resourceOre', title: 'Ore' },
              { type: 'resourceStone', title: 'Stone' },
              { type: 'resourceWood', title: 'Wood' }
            ]"
            :key="f.type"
            :type="f.type as any"
            :active="!!features?.[f.type as keyof NodeFeatures]"
            :has-reds="hasReds"
            :title="f.title"
            @toggle="emit('toggle', f.type as any)"
          />
        </div>
      </div>

      <hr class="transition-colors duration-300" :class="hasReds ? 'border-red-500/30' : 'border-gray-700/50'" />

      <!-- Other -->
      <div>
        <div class="text-[9px] uppercase text-gray-500 font-bold mb-1.5 tracking-wider" title="Other">Other</div>
        <div class="flex flex-wrap gap-1.5 justify-start pb-1">
          <ZoneFeatureToggle 
            v-for="f in [
              { type: 'crystalCreaturePresent', title: 'Crystal Creature' },
              { type: 'dungeonStatic', title: 'Static Dungeon' },
              { type: 'dungeonGroup', title: 'Group Dungeon' }
            ]"
            :key="f.type"
            :type="f.type as any"
            :active="!!features?.[f.type as keyof NodeFeatures]"
            :has-reds="hasReds"
            :title="f.title"
            @toggle="emit('toggle', f.type as any)"
          />
        </div>
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
