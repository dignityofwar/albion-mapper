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
  title: string | null;
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
            const EXPIRE_GRACE_MS = 6 * 60 * 60 * 1000;
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
              .filter((c) => {
                const expiresAt = new Date(c.expiresAt).getTime();
                return now.getTime() - expiresAt < EXPIRE_GRACE_MS;
              });

            const lastUpdatedAt = rows.reduce((max, row) => {
              return row.reported_at > max ? row.reported_at : max;
            }, room.updated_at || room.created_at);

            const { rows: nodePosRows } = await app.db.query<{ zone_id: string; x: number; y: number; features: any }>(
              'SELECT zone_id, x, y, features FROM room_node_positions WHERE room_id = $1',
              [roomId]
            );
            const nodePositions: NodePosition[] = nodePosRows.map((row) => ({
              zoneId: row.zone_id,
              x: row.x,
              y: row.y,
              features: row.features,
            }));

            send({ type: 'sync', connections, homeZoneId: room.home_zone_id, title: room.title || undefined, nodePositions, lastUpdatedAt });
          } catch {
            socket.close(4401, 'Invalid token');
          }
          return;
        }

        if (msg.type === 'update_node_positions') {
          if (!msg.nodePositions) return;

          // Deduplicate nodePositions by zoneId to prevent unique constraint violations
          const deduplicated = Array.from(
            msg.nodePositions.reduce((map, pos) => {
              map.set(pos.zoneId, pos);
              return map;
            }, new Map<string, NodePosition>()).values()
          );

          const client = await app.db.connect();
          try {
            await client.query('BEGIN');

            // Lock the room to serialize updates for the same room and prevent race conditions
            const { rows: homeZoneIdRows } = await client.query<{ home_zone_id: string }>(
              'SELECT home_zone_id FROM rooms WHERE id = $1 FOR UPDATE',
              [roomId]
            );
            const homeZoneIdRow = homeZoneIdRows[0];

            if (!homeZoneIdRow) {
              await client.query('ROLLBACK');
              return;
            }

            const homePos = (await client.query<{ x: number; y: number }>(
              'SELECT x, y FROM room_node_positions WHERE room_id = $1 AND zone_id = $2',
              [roomId, homeZoneIdRow.home_zone_id]
            )).rows[0];

            await client.query('DELETE FROM room_node_positions WHERE room_id = $1', [roomId]);
            for (const pos of deduplicated) {
              let x = pos.x;
              let y = pos.y;
              if (homePos && pos.zoneId === homeZoneIdRow.home_zone_id) {
                x = homePos.x;
                y = homePos.y;
                pos.x = x;
                pos.y = y;
              }
              await client.query(
                'INSERT INTO room_node_positions (room_id, zone_id, x, y, features) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (room_id, zone_id) DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y, features = EXCLUDED.features',
                [roomId, pos.zoneId, x, y, JSON.stringify(pos.features || {})]
              );
            }
            await client.query('COMMIT');
          } catch (e) {
            await client.query('ROLLBACK');
            throw e;
          } finally {
            client.release();
          }

          broadcast(roomId, { type: 'node_positions_updated', nodePositions: deduplicated }, socket);
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
