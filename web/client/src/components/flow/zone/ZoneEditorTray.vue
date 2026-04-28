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
}>();
</script>

<template>
  <Transition name="tray">
    <div v-if="isOpen" 
      class="text-left space-y-2 overflow-hidden px-1 py-2 transition-colors duration-300"
      :class="hasReds ? 'bg-red-900/20' : 'bg-gray-700/20 border-gray-700/50 border'"
    >
      <!-- Chests -->
      <div>
        <div class="text-[10px] uppercase text-gray-500 font-bold mb-1 px-1" title="Chests">Chests</div>
        <div class="flex flex-wrap gap-1.5 justify-center">
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
      
      <hr class="transition-colors duration-300" :class="hasReds ? 'border-red-500/50' : 'border-gray-700/50'" />

      <!-- Resources -->
      <div>
        <div class="text-[10px] uppercase text-gray-500 font-bold mb-1 px-1" title="Resources">Resources</div>
        <div class="flex flex-wrap gap-1.5 justify-center">
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

      <hr class="transition-colors duration-300" :class="hasReds ? 'border-red-500/50' : 'border-gray-700/50'" />

      <!-- Other -->
      <div>
        <div class="text-[10px] uppercase text-gray-500 font-bold mb-1 px-1" title="Other">Other</div>
        <div class="flex flex-wrap gap-1.5 justify-center pb-1">
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
  transition: all 0.3s ease-out;
  max-height: 500px;
}

.tray-enter-from,
.tray-leave-to {
  max-height: 0;
  opacity: 0;
  margin-top: 0;
}
</style>
