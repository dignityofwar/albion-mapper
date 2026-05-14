import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { RoomMemoryEntry } from 'shared';

export const useRoomMemoryStore = defineStore('roomMemory', () => {
  const memory = ref<Map<string, RoomMemoryEntry>>(new Map());

  function applyMemorySync(entries: RoomMemoryEntry[]) {
    const map = new Map<string, RoomMemoryEntry>();
    for (const entry of entries) {
      map.set(entry.zoneId, entry);
    }
    memory.value = map;
  }

  function applyMemoryUpdated(entry: RoomMemoryEntry) {
    const map = new Map(memory.value);
    map.set(entry.zoneId, entry);
    memory.value = map;
  }

  function getEntry(zoneId: string): RoomMemoryEntry | undefined {
    return memory.value.get(zoneId);
  }

  function applyMemoryDeleted(zoneId: string) {
    const map = new Map(memory.value);
    map.delete(zoneId);
    memory.value = map;
  }

  function clear() {
    memory.value = new Map();
  }

  return {
    memory,
    applyMemorySync,
    applyMemoryUpdated,
    applyMemoryDeleted,
    getEntry,
    clear,
  };
});
