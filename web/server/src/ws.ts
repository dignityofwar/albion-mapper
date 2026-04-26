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
  updated_at: string | null;
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
            const { rows: roomRows } = await app.db.query<DbRoom>('SELECT * FROM rooms WHERE id = $1', [roomId]);
            const room = roomRows[0];
            if (!room) {
              send({ type: 'error', message: 'Room not found' });
              socket.close(1008, 'Room not found');
              return;
            }

            const { rows: rows } = await app.db.query<DbConnection>(
              'SELECT * FROM connections WHERE room_id = $1',
              [roomId]
            );

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

            const lastUpdatedAt = rows.reduce((max, row) => {
              return row.reported_at > max ? row.reported_at : max;
            }, room.updated_at || room.created_at);

            const { rows: nodePosRows } = await app.db.query<{ zone_id: string; x: number; y: number }>(
              'SELECT zone_id, x, y FROM room_node_positions WHERE room_id = $1',
              [roomId]
            );
            const nodePositions: NodePosition[] = nodePosRows.map((row) => ({
              zoneId: row.zone_id,
              x: row.x,
              y: row.y,
            }));

            send({ type: 'sync', connections, homeZoneId: room.home_zone_id, nodePositions, lastUpdatedAt });
          } catch {
            socket.close(4401, 'Invalid token');
          }
          return;
        }

        if (msg.type === 'update_node_positions') {
          if (msg.nodePositions.length <= 1) return;

          const { rows: homeZoneIdRows } = await app.db.query<{ home_zone_id: string }>(
            'SELECT home_zone_id FROM rooms WHERE id = $1',
            [roomId]
          );
          const homeZoneIdRow = homeZoneIdRows[0];
          
          const homePos = homeZoneIdRow 
            ? (await app.db.query<{ x: number; y: number }>(
              'SELECT x, y FROM room_node_positions WHERE room_id = $1 AND zone_id = $2',
              [roomId, homeZoneIdRow.home_zone_id]
            )).rows[0]
            : undefined;

          const client = await app.db.connect();
          try {
            await client.query('BEGIN');
            await client.query('DELETE FROM room_node_positions WHERE room_id = $1', [roomId]);
            for (const pos of msg.nodePositions) {
              let x = pos.x;
              let y = pos.y;
              if (homePos && homeZoneIdRow && pos.zoneId === homeZoneIdRow.home_zone_id) {
                x = homePos.x;
                y = homePos.y;
                pos.x = x;
                pos.y = y;
              }
              await client.query(
                'INSERT INTO room_node_positions (room_id, zone_id, x, y) VALUES ($1, $2, $3, $4)',
                [roomId, pos.zoneId, x, y]
              );
            }
            await client.query(
              'UPDATE rooms SET updated_at = $1 WHERE id = $2',
              [new Date().toISOString(), roomId]
            );
            await client.query('COMMIT');
          } catch (e) {
            await client.query('ROLLBACK');
            throw e;
          } finally {
            client.release();
          }

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
