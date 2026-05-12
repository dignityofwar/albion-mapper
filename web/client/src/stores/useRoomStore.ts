import { defineStore } from 'pinia';
import { ref, nextTick } from 'vue';
import type { Connection, ServerMessage, NodePosition, NodeFeatures, CustomHandle } from 'shared';
import { API_BASE_URL } from '@/utils/api';
import { track } from '@vercel/analytics';
import { treeQuery } from '@/utils/treeQuery';

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'auth_failed';

export const useRoomStore = defineStore('room', () => {
  const connections = ref<Connection[]>([]);
  const homeZoneId = ref<string>('');
  const nodePositions = ref<NodePosition[]>([]);
  const roomTitle = ref<string>('');
  const wsStatus = ref<WsStatus>('disconnected');
  const lastUpdate = ref<Date | null>(null);
  const lastPing = ref<{zoneName: string, nodeId?: string} | null>(null);
  const watchingCount = ref<number | null>(null);
  const totalConnected = ref<number | null>(null);
  const token = ref<string>('');
  const roomId = ref<string>('');
  const isConnecting = ref(false);
  const connectingSourceHandleId = ref<string | null>(null);
  const connectingSourceNodeId = ref<string | null>(null);

  let ws: WebSocket | null = null;
  let reconnectDelay = 1000;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  function isNodeIsolated(nodeId: string, currentTime: number) {
    if (nodeId === homeZoneId.value) return false;
    const nodeConnections = connections.value.filter(c => c.fromZoneId === nodeId || c.toZoneId === nodeId);
    if (nodeConnections.length === 0) return true;
    return nodeConnections.every(c => (c.isExpired ?? false) || (new Date(c.expiresAt).getTime() - currentTime) <= 0);
  }

  function isNodeExpired(nodeId: string, currentTime: number) {
    if (nodeId === homeZoneId.value) return false;

    const nodeConnections = connections.value.filter(c => c.fromZoneId === nodeId || c.toZoneId === nodeId);

    // A node is expired if it has NO valid path to the hideout.
    // A path is valid if the connection itself is NOT expired AND the connection is NOT isolated (i.e., its ancestors are valid).
    const hasValidPathToHideout = nodeConnections.some(c =>
        !isEdgeIsolated(c.id, currentTime) &&
        !((c.isExpired ?? false) || (new Date(c.expiresAt).getTime() - currentTime) <= 0)
    );

    return !hasValidPathToHideout;
  }

  function isNodeRestricted(nodeId: string, currentTime: number) {
    return isNodeIsolated(nodeId, currentTime) || isNodeExpired(nodeId, currentTime);
  }

  function isEdgeIsolated(connectionId: string, currentTime: number) {
    const conn = connections.value.find(c => c.id === connectionId);
    if (!conn) return false;
    const ancestors = treeQuery(conn.id, connections.value, 'ancestors');
    return ancestors.some(a => (a.isExpired ?? false) || (new Date(a.expiresAt).getTime() - currentTime) <= 0);
  }

  function setCredentials(id: string, jwt: string) {
    roomId.value = id;
    token.value = jwt;
  }

  function send(msg: any) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function applyMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'sync':
        connections.value = msg.connections;
        homeZoneId.value = msg.homeZoneId;
        roomTitle.value = msg.title || '';
        nodePositions.value = msg.nodePositions;
        lastUpdate.value = new Date(msg.lastUpdatedAt);
        watchingCount.value = msg.watching;
        totalConnected.value = msg.totalConnected;
        addToRecentRooms(roomId.value, roomId.value, roomTitle.value);
        break;

      case 'connection_added':
        if (!connections.value.find((c) => c.id === msg.connection.id)) {
          connections.value = [...connections.value, msg.connection];
        }
        lastUpdate.value = new Date(msg.connection.reportedAt);
        // Mark the destination zone as explored when a non-center handle is used
        if (msg.connection.toHandleId && msg.connection.toHandleId !== 'center') {
          markNodeExplored(msg.connection.toZoneId);
        }
        if (msg.connection.fromHandleId && msg.connection.fromHandleId !== 'center') {
          markNodeExplored(msg.connection.fromZoneId);
        }
        break;

      case 'connection_updated':
        {
          const index = connections.value.findIndex((c) => c.id === msg.connection.id);
          if (index !== -1) {
            const newConnections = [...connections.value];
            newConnections[index] = msg.connection;
            connections.value = newConnections;
          }
          // Mark zones as explored when a non-center handle is assigned
          if (msg.connection.toHandleId && msg.connection.toHandleId !== 'center') {
            markNodeExplored(msg.connection.toZoneId);
          }
          if (msg.connection.fromHandleId && msg.connection.fromHandleId !== 'center') {
            markNodeExplored(msg.connection.fromZoneId);
          }
        }
        lastUpdate.value = new Date();
        break;

      case 'connection_removed':
        connections.value = connections.value.filter((c) => c.id !== msg.connectionId);
        lastUpdate.value = new Date();
        break;

      case 'connection_expired':
        {
          const index = connections.value.findIndex((c) => c.id === msg.connectionId);
          if (index !== -1) {
            const newConnections = [...connections.value];
            newConnections[index] = { ...newConnections[index], isExpired: true };
            connections.value = newConnections;
          }
        }
        lastUpdate.value = new Date();
        break;

      case 'room_updated':
        homeZoneId.value = msg.homeZoneId;
        lastUpdate.value = new Date();
        break;
      
      case 'room_reset':
        connections.value = [];
        nodePositions.value = nodePositions.value.filter(n => n.zoneId === homeZoneId.value);
        lastUpdate.value = new Date();
        break;
      
      case 'node_positions_updated':
        nodePositions.value = msg.nodePositions;
        if (msg.updateLastUpdated) {
          lastUpdate.value = new Date();
        }
        break;
      
      case 'ping':
        lastPing.value = null;
        nextTick(() => {
          lastPing.value = { zoneName: msg.zoneName, nodeId: msg.nodeId };
        });
        break;

      case 'marco':
        send({ type: 'polo' });
        break;

      case 'watching':
        watchingCount.value = msg.count;
        totalConnected.value = msg.totalConnected;
        break;
    }
  }

  function connect() {
    if (!roomId.value || !token.value) return;
    if (ws && ws.readyState === WebSocket.OPEN) return;

    wsStatus.value = 'connecting';
    const url = new URL(`${API_BASE_URL}/ws/rooms/${roomId.value}`);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(url.toString());

    ws.addEventListener('open', () => {
      ws!.send(JSON.stringify({ type: 'auth', token: token.value }));
    });

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        if (msg.type === 'auth_ok') {
          wsStatus.value = 'connected';
          lastUpdate.value = new Date();
          reconnectDelay = 1000;
        } else {
          applyMessage(msg);
        }
      } catch {
        // ignore bad JSON
      }
    });

    ws.addEventListener('close', (event) => {
      if (event.code === 4401) {
        wsStatus.value = 'auth_failed';
        return;
      }
      wsStatus.value = 'disconnected';
      scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      ws?.close();
    });
  }

  function scheduleReconnect() {
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
      connect();
    }, reconnectDelay);
  }

  function disconnect() {
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    ws?.close();
    ws = null;
    wsStatus.value = 'disconnected';
    connections.value = [];
    homeZoneId.value = '';
    roomTitle.value = '';
    nodePositions.value = [];
    roomId.value = '';
    token.value = '';
    watchingCount.value = null;
    totalConnected.value = null;
  }

  function logout() {
    sessionStorage.removeItem(`token:${roomId.value}`);
    disconnect();
    track('logout');
  }

  function updateNodePositionsInStore(positions: NodePosition[]) {
    if (!positions) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'update_node_positions', nodePositions: positions }));
      nodePositions.value = positions; // Optimistic update
      track('move_node');
    }
  }

  function resetNodePositions() {
    nodePositions.value = []; // Optimistic update
    lastUpdate.value = new Date();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'update_node_positions', nodePositions: [], updateLastUpdated: true }));
      track('reset_node_positions');
    }
  }

  function markNodeExplored(zoneId: string) {
    const index = nodePositions.value.findIndex(n => n.zoneId === zoneId);
    if (index === -1) return;
    if (nodePositions.value[index].explored) return;
    const newNodePositions = [...nodePositions.value];
    newNodePositions[index] = { ...newNodePositions[index], explored: true };
    nodePositions.value = newNodePositions;
    lastUpdate.value = new Date();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'update_node_positions', nodePositions: nodePositions.value, updateLastUpdated: true }));
    }
  }

  function updateNodeFeatures(zoneId: string, features: NodeFeatures) {
    const index = nodePositions.value.findIndex(n => n.zoneId === zoneId);
    if (index === -1) return;
    const newNodePositions = [...nodePositions.value];
    const featuresWithTimestamp = { ...features, lastUpdatedAt: Date.now() };
    newNodePositions[index] = { ...newNodePositions[index], features: featuresWithTimestamp, explored: true };
    nodePositions.value = newNodePositions;
    lastUpdate.value = new Date();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'update_node_positions', nodePositions: nodePositions.value, updateLastUpdated: true }));
      track('update_node_features');
    }
  }

  function updateNodeCustomHandles(zoneId: string, customHandles: CustomHandle[]) {
    const index = nodePositions.value.findIndex(n => n.zoneId === zoneId);
    if (index === -1) return;
    const newNodePositions = [...nodePositions.value];
    newNodePositions[index] = { ...newNodePositions[index], customHandles, explored: true };
    nodePositions.value = newNodePositions;
    lastUpdate.value = new Date();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'update_node_positions', nodePositions: nodePositions.value, updateLastUpdated: true }));
      track('update_node_handles');
    }
  }

  // Recently Viewed Rooms
  interface RecentRoom {
    id: string;
    vanityUrl: string;
    title: string;
  }

  const recentlyViewedRooms = ref<RecentRoom[]>(JSON.parse(localStorage.getItem('recentRooms') || '[]').map((r: any) => ({
    id: r.id,
    vanityUrl: r.vanityUrl || r.id,
    title: r.title,
  })));

  function addToRecentRooms(id: string, vanityUrl: string, title: string) {
    if (!id) return;
    const existing = recentlyViewedRooms.value.findIndex(r => r.id === id);
    if (existing !== -1) {
      recentlyViewedRooms.value.splice(existing, 1);
    }
    recentlyViewedRooms.value.unshift({ id, vanityUrl, title: title || id });
    recentlyViewedRooms.value = recentlyViewedRooms.value.slice(0, 10); // Keep last 10
    localStorage.setItem('recentRooms', JSON.stringify(recentlyViewedRooms.value));
  }

  function removeFromRecentRooms(id: string) {
    recentlyViewedRooms.value = recentlyViewedRooms.value.filter(r => r.id !== id);
    localStorage.setItem('recentRooms', JSON.stringify(recentlyViewedRooms.value));
  }

  async function importData(data: { connections: any[], nodePositions: NodePosition[], homeZoneId: string }) {
    if (!roomId.value || !token.value) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId.value}/import`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to import data: ${await response.text()}`);
    }
  }

  return {
    connections,
    homeZoneId,
    roomTitle,
    nodePositions,
    wsStatus,
    lastUpdate,
    lastPing,
    watchingCount,
    totalConnected,
    token,
    roomId,
    isConnecting,
    connectingSourceHandleId,
    connectingSourceNodeId,
    recentlyViewedRooms,
    setCredentials,
    applyMessage,
    updateNodePositionsInStore,
    markNodeExplored,
    updateNodeFeatures,
    updateNodeCustomHandles,
    isNodeIsolated,
    isNodeExpired,
    isNodeRestricted,
    isEdgeIsolated,
    resetNodePositions,
    send,
    connect,
    disconnect,
    logout,
    removeFromRecentRooms,
    importData,
  };
});
