import type { FastifyInstance } from 'fastify';
import { ZONE_BY_ID, type Connection, type ClientMessage, type ServerMessage, type NodePosition, type RoomMemoryEntry } from 'shared';
import { addSocket, removeSocket, broadcast, getTotalSocketCount } from './broadcast.js';
import { recordPolo, getWatchingCount } from './marcopolo.js';

interface DbConnection {
  id: string;
  room_id: string;
  from_zone_id: string;
  to_zone_id: string;
  from_handle_id: string | null;
  to_handle_id: string | null;
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
  plotted_route: string[] | null;
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
          broadcast(roomId, { type: 'ping', zoneName: msg.zoneName, nodeId: msg.nodeId });
          return;
        }

        if (msg.type === 'polo') {
          if (authenticated) recordPolo(socket);
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
                fromHandleId: row.from_handle_id ?? undefined,
                toHandleId: row.to_handle_id ?? undefined,
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

            const { rows: nodePosRows } = await app.db.query<{ zone_id: string; x: number; y: number; features: any; custom_handles: any; rotation: number; explored: boolean }>(
              'SELECT zone_id, x, y, features, custom_handles, rotation, explored FROM room_node_positions WHERE room_id = $1',
              [roomId]
            );
            const nodePositions: NodePosition[] = nodePosRows.map((row) => ({
              zoneId: row.zone_id,
              x: row.x,
              y: row.y,
              features: row.features,
              customHandles: row.custom_handles,
              rotation: row.rotation ?? 0,
              explored: row.explored ?? false,
            }));

            const { rows: memoryRows } = await app.db.query<{ zone_id: string; times_added: string[]; features: any; custom_handles: any; rotation: number; last_updated: string }>(
              'SELECT zone_id, times_added, features, custom_handles, rotation, last_updated FROM room_node_memory WHERE room_id = $1',
              [roomId]
            );
            const memory: RoomMemoryEntry[] = memoryRows
              .filter((row) => {
                const zone = ZONE_BY_ID.get(row.zone_id);
                return zone?.type === 'roads' || zone?.type === 'roadsHideout';
              })
              .map((row) => ({
                zoneId: row.zone_id,
                timesAdded: row.times_added,
                features: row.features ?? undefined,
                customHandles: row.custom_handles ?? undefined,
                rotation: row.rotation ?? 0,
                lastUpdated: row.last_updated,
              }));

            send({ type: 'sync', connections, homeZoneId: room.home_zone_id, title: room.title || undefined, nodePositions, lastUpdatedAt, watching: getWatchingCount(roomId), totalConnected: getTotalSocketCount(), plottedRoute: room.plotted_route ?? undefined });
            send({ type: 'memory_sync', memory });
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

            await client.query('DELETE FROM room_node_positions WHERE room_id = $1', [roomId]);
            for (const pos of deduplicated) {
              await client.query(
                'INSERT INTO room_node_positions (room_id, zone_id, x, y, features, custom_handles, rotation, explored) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (room_id, zone_id) DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y, features = EXCLUDED.features, custom_handles = EXCLUDED.custom_handles, rotation = EXCLUDED.rotation, explored = EXCLUDED.explored',
                [roomId, pos.zoneId, pos.x, pos.y, JSON.stringify(pos.features || {}), JSON.stringify(pos.customHandles || null), pos.rotation ?? 0, pos.explored ?? false]
              );
            }
            if (msg.updateLastUpdated) {
              await client.query(
                'UPDATE rooms SET updated_at = $1 WHERE id = $2',
                [new Date().toISOString(), roomId]
              );
            }
            await client.query('COMMIT');
          } catch (e) {
            await client.query('ROLLBACK');
            throw e;
          } finally {
            client.release();
          }

          // Re-read from DB so the broadcast contains authoritative values (e.g. explored flag)
          const { rows: updatedRows } = await app.db.query<{ zone_id: string; x: number; y: number; features: any; custom_handles: any; rotation: number; explored: boolean }>(
            'SELECT zone_id, x, y, features, custom_handles, rotation, explored FROM room_node_positions WHERE room_id = $1',
            [roomId]
          );
          const broadcastPositions: NodePosition[] = updatedRows.map((row) => ({
            zoneId: row.zone_id,
            x: row.x,
            y: row.y,
            features: row.features,
            customHandles: row.custom_handles,
            rotation: row.rotation ?? 0,
            explored: row.explored ?? false,
          }));
          broadcast(roomId, { type: 'node_positions_updated', nodePositions: broadcastPositions, updateLastUpdated: msg.updateLastUpdated }, socket);

          // Update zone memory for nodes that already have a memory entry,
          // storing only map features (resources) and custom handles.
          // Skip non-roads zones.
          const now = new Date().toISOString();
          for (const pos of deduplicated) {
            const zone = ZONE_BY_ID.get(pos.zoneId);
            if (zone?.type !== 'roads' && zone?.type !== 'roadsHideout') continue;

            const memoryFeatures = (() => {
              const f = pos.features;
              if (!f) return null;
              const result: Record<string, any> = {};
              if (f.resources && f.resources.length > 0) result.resources = f.resources;
              if (f.treasuresGreenCount !== undefined) result.treasuresGreenCount = f.treasuresGreenCount;
              if (f.treasuresBlueCount !== undefined) result.treasuresBlueCount = f.treasuresBlueCount;
              if (f.treasuresYellowCount !== undefined) result.treasuresYellowCount = f.treasuresYellowCount;
              if (f.upstreamFeatures && f.upstreamFeatures.length > 0) result.upstreamFeatures = f.upstreamFeatures;
              // crystalCreaturePresent is intentionally excluded (temporary flag)
              // chest/chestTimer are intentionally excluded (timed chest, not permanent)
              return Object.keys(result).length > 0 ? result : null;
            })();
            const memoryHandles = pos.customHandles && pos.customHandles.length > 0
              ? pos.customHandles
              : null;

            // Only update if a memory entry already exists for this zone
            const { rows: existing } = await app.db.query<{ zone_id: string }>(
              'SELECT zone_id FROM room_node_memory WHERE room_id = $1 AND zone_id = $2',
              [roomId, pos.zoneId]
            );
            if (existing.length === 0) continue;

            await app.db.query(`
              UPDATE room_node_memory
              SET features = $1, custom_handles = $2, rotation = $3, last_updated = $4
              WHERE room_id = $5 AND zone_id = $6
            `, [
              JSON.stringify(memoryFeatures),
              JSON.stringify(memoryHandles),
              pos.rotation ?? 0,
              now,
              roomId,
              pos.zoneId,
            ]);

            const { rows: updatedMem } = await app.db.query<{ zone_id: string; times_added: string[]; features: any; custom_handles: any; rotation: number; last_updated: string }>(
              'SELECT zone_id, times_added, features, custom_handles, rotation, last_updated FROM room_node_memory WHERE room_id = $1 AND zone_id = $2',
              [roomId, pos.zoneId]
            );
            if (updatedMem[0]) {
              const entry: RoomMemoryEntry = {
                zoneId: updatedMem[0].zone_id,
                timesAdded: updatedMem[0].times_added,
                features: updatedMem[0].features ?? undefined,
                customHandles: updatedMem[0].custom_handles ?? undefined,
                rotation: updatedMem[0].rotation ?? 0,
                lastUpdated: updatedMem[0].last_updated,
              };
              broadcast(roomId, { type: 'memory_updated', entry });
            }
          }
          return;
        }

        if (msg.type === 'update_plot_route') {
          if (!authenticated) return;
          const plottedRoute = Array.isArray(msg.plottedRoute) ? msg.plottedRoute : [];
          const destinationZoneId = msg.destinationZoneId;
          await app.db.query(
            'UPDATE rooms SET plotted_route = $1 WHERE id = $2',
            [plottedRoute.length > 0 ? plottedRoute : null, roomId]
          );
          broadcast(roomId, { type: 'plot_route_updated', plottedRoute, destinationZoneId }, socket);
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
