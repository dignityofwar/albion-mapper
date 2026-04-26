import type { FastifyInstance } from 'fastify';
import { getConnectionStatus } from 'shared';
import type { Connection, ClientMessage, ServerMessage } from 'shared';
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

            send({ type: 'sync', connections, homeZoneId: room.home_zone_id });
          } catch {
            socket.close(4401, 'Invalid token');
          }
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
