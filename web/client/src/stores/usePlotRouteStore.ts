import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Connection } from 'shared';
import { useRoomStore } from '@/stores/useRoomStore';

export const usePlotRouteStore = defineStore('plotRoute', () => {
  const isPlotRouteMode = ref(false);
  const destinationZoneId = ref<string | null>(null);
  const plottedConnectionIds = ref<Set<string>>(new Set());

  function sendRouteUpdate(ids: string[], destinationZoneId?: string) {
    console.log('[PlotRoute] sendRouteUpdate CALLED with ids:', ids);
    console.trace('[PlotRoute] sendRouteUpdate call stack');
    try {
      const roomStore = useRoomStore();
      console.log('[PlotRoute] roomStore obtained, wsStatus:', roomStore.wsStatus, 'send fn:', typeof roomStore.send);
      roomStore.send({ type: 'update_plot_route', plottedRoute: ids, destinationZoneId });
    } catch (e) {
      console.error('[PlotRoute] sendRouteUpdate error', e);
    }
  }

  function enterPlotRouteMode() {
    isPlotRouteMode.value = true;
    destinationZoneId.value = null;
    plottedConnectionIds.value = new Set();
  }

  function exitPlotRouteMode() {
    isPlotRouteMode.value = false;
    destinationZoneId.value = null;
    plottedConnectionIds.value = new Set();
    sendRouteUpdate([]);
  }

  function computeRoute(homeZoneId: string, targetZoneId: string, connections: Connection[]) {
    // BFS from homeZoneId to targetZoneId, collecting connection IDs along the path
    if (homeZoneId === targetZoneId) {
      plottedConnectionIds.value = new Set();
      return;
    }

    // Build adjacency: zoneId -> list of {connectionId, neighborZoneId}
    const adj = new Map<string, { connectionId: string; neighborZoneId: string }[]>();
    for (const conn of connections) {
      if (!adj.has(conn.fromZoneId)) adj.set(conn.fromZoneId, []);
      adj.get(conn.fromZoneId)!.push({ connectionId: conn.id, neighborZoneId: conn.toZoneId });
      if (!adj.has(conn.toZoneId)) adj.set(conn.toZoneId, []);
      adj.get(conn.toZoneId)!.push({ connectionId: conn.id, neighborZoneId: conn.fromZoneId });
    }

    // BFS
    const visited = new Set<string>();
    const queue: { zoneId: string; path: string[] }[] = [{ zoneId: homeZoneId, path: [] }];
    visited.add(homeZoneId);

    while (queue.length > 0) {
      const { zoneId, path } = queue.shift()!;

      if (zoneId === targetZoneId) {
        plottedConnectionIds.value = new Set(path);
        return;
      }

      const neighbors = adj.get(zoneId) || [];
      for (const { connectionId, neighborZoneId } of neighbors) {
        if (!visited.has(neighborZoneId)) {
          visited.add(neighborZoneId);
          queue.push({ zoneId: neighborZoneId, path: [...path, connectionId] });
        }
      }
    }

    // No path found
    plottedConnectionIds.value = new Set();
  }

  function selectDestination(homeZoneId: string, targetZoneId: string, connections: Connection[]) {
    destinationZoneId.value = targetZoneId;
    computeRoute(homeZoneId, targetZoneId, connections);
    isPlotRouteMode.value = false;
    sendRouteUpdate(Array.from(plottedConnectionIds.value), targetZoneId);
  }

  /** Called when a connection is removed — clears route if it was part of the plotted path */
  function onConnectionRemoved(connectionId: string) {
    if (plottedConnectionIds.value.has(connectionId)) {
      isPlotRouteMode.value = false;
      destinationZoneId.value = null;
      plottedConnectionIds.value = new Set();
      sendRouteUpdate([]);
    }
  }

  /** Called when a node (zone) is deleted — clears route if destination was that zone */
  function onNodeRemoved(zoneId: string) {
    if (destinationZoneId.value === zoneId) {
      isPlotRouteMode.value = false;
      destinationZoneId.value = null;
      plottedConnectionIds.value = new Set();
      sendRouteUpdate([]);
    }
  }

  /** Apply a plotted route received from the server (sync/broadcast) */
  function applyPlottedRoute(connectionIds: string[], targetZoneId?: string) {
    plottedConnectionIds.value = new Set(connectionIds);
    if (connectionIds.length === 0) {
      isPlotRouteMode.value = false;
      destinationZoneId.value = null;
    } else if (targetZoneId) {
      destinationZoneId.value = targetZoneId;
    }
  }

  const hasRoute = computed(() => plottedConnectionIds.value.size > 0);

  return {
    isPlotRouteMode,
    destinationZoneId,
    plottedConnectionIds,
    hasRoute,
    enterPlotRouteMode,
    exitPlotRouteMode,
    selectDestination,
    onConnectionRemoved,
    onNodeRemoved,
    applyPlottedRoute,
  };
});
