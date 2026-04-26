import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Connection, ServerMessage } from 'shared';

export type WsStatus = 'disconnected' | 'connecting' | 'connected';

export const useRoomStore = defineStore('room', () => {
  const connections = ref<Connection[]>([]);
  const homeZoneId = ref<string>('');
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
    lastUpdate.value = new Date();
    switch (msg.type) {
      case 'sync':
        connections.value = msg.connections;
        homeZoneId.value = msg.homeZoneId;
        break;

      case 'connection_added':
        if (!connections.value.find((c) => c.id === msg.connection.id)) {
          connections.value.push(msg.connection);
        }
        break;

      case 'connection_removed':
        connections.value = connections.value.filter((c) => c.id !== msg.connectionId);
        break;

      case 'room_updated':
        homeZoneId.value = msg.homeZoneId;
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

  return {
    connections,
    homeZoneId,
    wsStatus,
    lastUpdate,
    token,
    roomId,
    setCredentials,
    applyMessage,
    connect,
    disconnect,
  };
});
