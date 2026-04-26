import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Connection, ServerMessage, NodePosition } from 'shared';

export type WsStatus = 'disconnected' | 'connecting' | 'connected';

export const useRoomStore = defineStore('room', () => {
  const connections = ref<Connection[]>([]);
  const homeZoneId = ref<string>('');
  const nodePositions = ref<NodePosition[]>([]);
  const wsStatus = ref<WsStatus>('disconnected');
  const lastUpdate = ref<Date | null>(null);
  const token = ref<string>('');
  const roomId = ref<string>('');

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
        nodePositions.value = msg.nodePositions;
        lastUpdate.value = new Date(msg.lastUpdatedAt);
        break;

      case 'connection_added':
        if (!connections.value.find((c) => c.id === msg.connection.id)) {
          connections.value.push(msg.connection);
        }
        lastUpdate.value = new Date(msg.connection.reportedAt);
        break;

      case 'connection_removed':
        connections.value = connections.value.filter((c) => c.id !== msg.connectionId);
        lastUpdate.value = new Date();
        break;

      case 'connection_expired':
        {
          const conn = connections.value.find((c) => c.id === msg.connectionId);
          if (conn) {
            conn.isExpired = true;
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
        lastUpdate.value = new Date();
        break;
    }
  }

  function connect() {
    if (!roomId.value || !token.value) return;
    if (ws && ws.readyState === WebSocket.OPEN) return;

    wsStatus.value = 'connecting';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws/rooms/${roomId.value}`);

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
  }

  function updateNodePositionsInStore(positions: NodePosition[]) {
    if (positions.length <= 1) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'update_node_positions', nodePositions: positions }));
      nodePositions.value = positions; // Optimistic update
      lastUpdate.value = new Date();
    }
  }

  return {
    connections,
    homeZoneId,
    nodePositions,
    wsStatus,
    lastUpdate,
    token,
    roomId,
    setCredentials,
    applyMessage,
    updateNodePositionsInStore,
    connect,
    disconnect,
  };
});
