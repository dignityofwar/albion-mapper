import type { FastifyInstance } from 'fastify';
import { getConnectionStatus } from 'shared';
import type { Connection, ClientMessage, ServerMessage, NodePosition } from 'shared';
import { addSocket, removeSocket, broadcast } from './broadcast.js';

interface DbConnection {
  id: string;
  room_id: string;
  from_zone_id: string;
  to_zone_id: string;
  expires_at: string;
  reported_at: string;
  reported_by: string | null;
}

interface DbRoom {
  id: string;
  password_hash: string;
  home_zone_id: string;
  created_at: string;
}

export async function wsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>(
    '/ws/rooms/:id',
    { websocket: true },
    (socket, request) => {
      const roomId = (request.params as { id: string }).id;
      let authenticated = false;

      const send = (msg: ServerMessage) => {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify(msg));
        }
      };

      const authTimeout = setTimeout(() => {
        if (!authenticated) {
          socket.close(4401, 'Authentication required');
        }
      }, 10_000);

      socket.on('message', async (rawData) => {
        let msg: ClientMessage;
        try {
          msg = JSON.parse(rawData.toString()) as ClientMessage;
        } catch {
          send({ type: 'error', message: 'Invalid JSON' });
          return;
        }

        if (msg.type === 'ping') {
          return;
        }

        if (msg.type === 'auth') {
          if (authenticated) return;

          try {
            const payload = app.jwt.verify(msg.token) as { roomId: string };
            if (payload.roomId !== roomId) {
              socket.close(4401, 'Token room mismatch');
              return;
            }

            clearTimeout(authTimeout);
            authenticated = true;
            addSocket(roomId, socket);

            send({ type: 'auth_ok' });

            // Send initial sync
            const room = app.db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as DbRoom | undefined;
            if (!room) {
              send({ type: 'error', message: 'Room not found' });
              socket.close(1008, 'Room not found');
              return;
            }

            const rows = app.db
              .prepare('SELECT * FROM connections WHERE room_id = ?')
              .all(roomId) as DbConnection[];

            const now = new Date();
            const connections: Connection[] = rows
              .map((row) => ({
                id: row.id,
                roomId: row.room_id,
                fromZoneId: row.from_zone_id,
                toZoneId: row.to_zone_id,
                expiresAt: row.expires_at,
                reportedAt: row.reported_at,
                reportedBy: row.reported_by ?? undefined,
              }))
              .filter((c) => getConnectionStatus(c, now) !== 'expired');

            const nodePosRows = app.db
              .prepare('SELECT zone_id, x, y FROM room_node_positions WHERE room_id = ?')
              .all(roomId) as { zone_id: string; x: number; y: number }[];
            const nodePositions: NodePosition[] = nodePosRows.map((row) => ({
              zoneId: row.zone_id,
              x: row.x,
              y: row.y,
            }));

            send({ type: 'sync', connections, homeZoneId: room.home_zone_id, nodePositions });
          } catch {
            socket.close(4401, 'Invalid token');
          }
          return;
        }

        if (msg.type === 'update_node_positions') {
          if (msg.nodePositions.length <= 1) return;

          const homeZoneIdRow = app.db.prepare('SELECT home_zone_id FROM rooms WHERE id = ?').get(roomId) as { home_zone_id: string } | undefined;
          const homePos = homeZoneIdRow 
            ? (app.db.prepare('SELECT x, y FROM room_node_positions WHERE room_id = ? AND zone_id = ?').get(roomId, homeZoneIdRow.home_zone_id) as { x: number, y: number } | undefined)
            : undefined;

          const insert = app.db.prepare('INSERT INTO room_node_positions (room_id, zone_id, x, y) VALUES (?, ?, ?, ?)');
          const transaction = app.db.transaction((positions: NodePosition[]) => {
            app.db.prepare('DELETE FROM room_node_positions WHERE room_id = ?').run(roomId);
            for (const pos of positions) {
              let x = pos.x;
              let y = pos.y;
              if (homePos && homeZoneIdRow && pos.zoneId === homeZoneIdRow.home_zone_id) {
                x = homePos.x;
                y = homePos.y;
                pos.x = x;
                pos.y = y;
              }
              insert.run(roomId, pos.zoneId, x, y);
            }
          });
          transaction(msg.nodePositions);
          broadcast(roomId, { type: 'node_positions_updated', nodePositions: msg.nodePositions }, socket);
          return;
        }

        if (!authenticated) {
          socket.close(4401, 'Not authenticated');
        }
      });

      socket.on('close', () => {
        clearTimeout(authTimeout);
        if (authenticated) {
          removeSocket(roomId, socket);
        }
      });

      socket.on('error', () => {
        clearTimeout(authTimeout);
        if (authenticated) {
          removeSocket(roomId, socket);
        }
      });
    },
  );
}

export { broadcast };
