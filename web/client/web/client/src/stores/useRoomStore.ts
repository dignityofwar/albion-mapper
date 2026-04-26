import { defineStore } from 'pinia';
import type { Connection, ServerMessage, NodePosition } from 'shared';

export type WsStatus = 'disconnected' | 'connecting' | 'connected';

export const useRoomStore = defineStore('room', {
  state: () => ({
    connections: [] as Connection[],
    homeZoneId: '' as string,
    nodePositions: [] as NodePosition[],
    wsStatus: 'disconnected' as WsStatus,
    lastUpdate: null as Date | null,
    token: '' as string,
    roomId: '' as string,
    ws: null as WebSocket | null,
    reconnectTimeout: null as ReturnType<typeof setTimeout> | null,
    reconnectDelay: 1000,
  }),
  actions: {
    setCredentials(id: string, jwt: string) {
      this.roomId = id;
      this.token = jwt;
    },
    applyMessage(msg: ServerMessage) {
      this.lastUpdate = new Date();
      switch (msg.type) {
        case 'sync':
          this.connections = msg.connections;
          this.homeZoneId = msg.homeZoneId;
          this.nodePositions = msg.nodePositions;
          break;

        case 'connection_added':
          if (!this.connections.find((c) => c.id === msg.connection.id)) {
            this.connections.push(msg.connection);
          }
          break;

        case 'connection_removed':
          this.connections = this.connections.filter((c) => c.id !== msg.connectionId);
          break;

        case 'room_updated':
          this.homeZoneId = msg.homeZoneId;
          break;

        case 'node_positions_updated':
          this.nodePositions = msg.nodePositions;
          break;
      }
    },
    connect() {
      if (!this.roomId || !this.token) return;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

      this.wsStatus = 'connecting';
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(`${protocol}//${window.location.host}/ws/rooms/${this.roomId}`);

      this.ws.addEventListener('open', () => {
        this.ws!.send(JSON.stringify({ type: 'auth', token: this.token }));
      });

      this.ws.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data as string) as ServerMessage;
          if (msg.type === 'auth_ok') {
            this.wsStatus = 'connected';
            this.lastUpdate = new Date();
            this.reconnectDelay = 1000;
          } else {
            this.applyMessage(msg);
          }
        } catch {
          // ignore bad JSON
        }
      });

      this.ws.addEventListener('close', () => {
        this.wsStatus = 'disconnected';
        this.scheduleReconnect();
      });

      this.ws.addEventListener('error', () => {
        this.ws?.close();
      });
    },
    scheduleReconnect() {
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
        this.connect();
      }, this.reconnectDelay);
    },
    disconnect() {
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      this.ws?.close();
      this.ws = null;
      this.wsStatus = 'disconnected';
      this.connections = [];
      this.homeZoneId = '';
    },
    updateNodePositionsInStore(positions: NodePosition[]) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'update_node_positions', nodePositions: positions }));
        this.nodePositions = positions; // Optimistic update
      }
    },
  },
});
