import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Connection, ServerMessage, NodePosition, NodeFeatures, CustomHandle } from 'shared';
import { API_BASE_URL } from '../utils/api';

export type WsStatus = 'disconnected' | 'connecting' | 'connected';

export const useRoomStore = defineStore('room', () => {
  const connections = ref<Connection[]>([]);
  const homeZoneId = ref<string>('');
  const nodePositions = ref<NodePosition[]>([]);
  const roomTitle = ref<string>('');
  const wsStatus = ref<WsStatus>('disconnected');
  const lastUpdate = ref<Date | null>(null);
  const token = ref<string>('');
  const roomId = ref<string>('');
  const showDefaultHandles = ref<boolean>(false);

  let ws: WebSocket | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = 1000;

  function setCredentials(id: string, jwt: string) {
    roomId.value = id;
    token.value = jwt;
  }

  function applyMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'sync':
        connections.value = msg.connections;
        homeZoneId.value = msg.homeZoneId;
        roomTitle.value = msg.title || '';
        nodePositions.value = msg.nodePositions;
        lastUpdate.value = new Date(msg.lastUpdatedAt);
        addToRecentRooms(roomId.value, roomTitle.value);
        break;

      case 'connection_added':
        if (!connections.value.find((c) => c.id === msg.connection.id)) {
          connections.value = [...connections.value, msg.connection];
        }
        lastUpdate.value = new Date(msg.connection.reportedAt);
        break;

      case 'connection_updated':
        {
          const index = connections.value.findIndex((c) => c.id === msg.connection.id);
          if (index !== -1) {
            const newConnections = [...connections.value];
            newConnections[index] = msg.connection;
            connections.value = newConnections;
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

    ws.addEventListener('close', () => {
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
  }

  function updateNodePositionsInStore(positions: NodePosition[]) {
    if (!positions) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'update_node_positions', nodePositions: positions }));
      nodePositions.value = positions; // Optimistic update
    }
  }

  function resetNodePositions() {
    nodePositions.value = []; // Optimistic update
    lastUpdate.value = new Date();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'update_node_positions', nodePositions: [], updateLastUpdated: true }));
    }
  }

  function updateNodeFeatures(zoneId: string, features: NodeFeatures) {
    const index = nodePositions.value.findIndex(n => n.zoneId === zoneId);
    if (index === -1) return;
    const newNodePositions = [...nodePositions.value];
    newNodePositions[index] = { ...newNodePositions[index], features };
    nodePositions.value = newNodePositions;
    lastUpdate.value = new Date();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'update_node_positions', nodePositions: nodePositions.value, updateLastUpdated: true }));
    }
  }

  function updateNodeCustomHandles(zoneId: string, customHandles: CustomHandle[]) {
    const index = nodePositions.value.findIndex(n => n.zoneId === zoneId);
    if (index === -1) return;
    const newNodePositions = [...nodePositions.value];
    newNodePositions[index] = { ...newNodePositions[index], customHandles };
    nodePositions.value = newNodePositions;
    lastUpdate.value = new Date();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'update_node_positions', nodePositions: nodePositions.value, updateLastUpdated: true }));
    }
  }

  // Recently Viewed Rooms
  interface RecentRoom {
    id: string;
    title: string;
  }

  const recentlyViewedRooms = ref<RecentRoom[]>(JSON.parse(localStorage.getItem('recentRooms') || '[]'));

  function addToRecentRooms(id: string, title: string) {
    if (!id) return;
    const existing = recentlyViewedRooms.value.findIndex(r => r.id === id);
    if (existing !== -1) {
      recentlyViewedRooms.value.splice(existing, 1);
    }
    recentlyViewedRooms.value.unshift({ id, title: title || id });
    recentlyViewedRooms.value = recentlyViewedRooms.value.slice(0, 10); // Keep last 10
    localStorage.setItem('recentRooms', JSON.stringify(recentlyViewedRooms.value));
  }

  function removeFromRecentRooms(id: string) {
    recentlyViewedRooms.value = recentlyViewedRooms.value.filter(r => r.id !== id);
    localStorage.setItem('recentRooms', JSON.stringify(recentlyViewedRooms.value));
  }

  return {
    connections,
    homeZoneId,
    roomTitle,
    nodePositions,
    wsStatus,
    lastUpdate,
    token,
    roomId,
    recentlyViewedRooms,
    setCredentials,
    applyMessage,
    updateNodePositionsInStore,
    updateNodeFeatures,
    updateNodeCustomHandles,
    resetNodePositions,
    connect,
    disconnect,
    removeFromRecentRooms,
  };
});
