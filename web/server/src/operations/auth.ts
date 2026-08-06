import { nanoid } from 'nanoid';
import { PRIMARY_CHAIN_COLOR, ROOM_SERVERS, ZONE_BY_ID, type Connection, type NodePosition, type RoomMemoryEntry, type RoomServer } from 'shared';
import { addSocket, broadcast, getTotalSocketCount } from '../broadcast.js';
import { getWatchingCount } from '../marcopolo.js';
import type { OperationHandler } from './types.js';
import type { ClientMessage } from 'shared';
import { safeRollback } from '../db_tx.js';

interface DbRoom {
  id: string;
  title: string | null;
  server: string | null;
  password_hash: string;
  home_zone_id: string;
  created_at: string;
  updated_at: string | null;
  plotted_route: string[] | null;
  plotted_route_from_zone_id: string | null;
  plotted_route_to_zone_id: string | null;
  plotted_route_chain_id: string | null;
  chain_migrated: boolean;
  locked: boolean | null;
}

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
  chain_id: string | null;
  permanent: boolean | null;
}

export const handleAuth: OperationHandler<Extract<ClientMessage, { type: 'auth' }>> = async (
  ctx,
  msg
) => {
  if (ctx.authenticated) return;

  try {
    const payload = ctx.app.jwt.verify(msg.token) as { roomId: string };
    if (payload.roomId !== ctx.roomId) {
      ctx.socket.close(4401, 'Token room mismatch');
      return;
    }

    clearTimeout(ctx.authTimeout);
    ctx.setAuthenticated(true);
    ctx.setSessionToken(msg.token);
    addSocket(ctx.roomId, ctx.socket, msg.token);

    ctx.send({ type: 'auth_ok' });

    // Send initial sync
    const { rows: roomRows } = await ctx.app.db.query<DbRoom>('SELECT * FROM rooms WHERE id = $1', [ctx.roomId]);
    const room = roomRows[0];
    if (!room) {
      ctx.send({ type: 'error', message: 'Room not found' });
      ctx.socket.close(1008, 'Room not found');
      return;
    }

    // Lazy migration: backfill room_chains for legacy single-home rooms
    if (!room.chain_migrated) {
      const migrationClient = await ctx.app.db.connect();
      try {
        await migrationClient.query('BEGIN');
        const chainId = nanoid();
        await migrationClient.query(
          'INSERT INTO room_chains (id, room_id, source_zone_id, created_at, chain_number, chain_color) VALUES ($1, $2, $3, $4, $5, $6)',
          [chainId, ctx.roomId, room.home_zone_id, new Date().toISOString(), 1, PRIMARY_CHAIN_COLOR]
        );
        await migrationClient.query(
          'UPDATE connections SET chain_id = $1 WHERE room_id = $2 AND chain_id IS NULL',
          [chainId, ctx.roomId]
        );
        await migrationClient.query(
          'UPDATE room_node_positions SET chain_id = $1 WHERE room_id = $2 AND chain_id IS NULL',
          [chainId, ctx.roomId]
        );
        await migrationClient.query(
          'UPDATE rooms SET chain_migrated = true WHERE id = $1',
          [ctx.roomId]
        );
        await migrationClient.query('COMMIT');
      } catch (err) {
        await safeRollback(migrationClient);
        throw err;
      } finally {
        migrationClient.release();
      }
      broadcast(ctx.roomId, { type: 'force_reload' });
      return;
    }

    const { rows: chainRows } = await ctx.app.db.query<{ id: string; source_zone_id: string; chain_number: number | null; chain_color: string | null }>(
      'SELECT id, source_zone_id, chain_number, chain_color FROM room_chains WHERE room_id = $1 ORDER BY chain_number ASC NULLS LAST, created_at ASC',
      [ctx.roomId]
    );
    const chains = chainRows.map((row, idx) => ({
      id: row.id,
      sourceZoneId: row.source_zone_id,
      // Defensive fallbacks in case the migration hasn't backfilled yet.
      chainNumber: row.chain_number ?? idx + 1,
      chainColor: row.chain_color ?? PRIMARY_CHAIN_COLOR,
    }));

    const { rows: rows } = await ctx.app.db.query<DbConnection>(
      'SELECT * FROM connections WHERE room_id = $1',
      [ctx.roomId]
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
        chainId: row.chain_id ?? undefined,
        permanent: row.permanent ?? undefined,
      }))
      .filter((c) => {
        if (c.permanent) return true;
        const expiresAt = new Date(c.expiresAt).getTime();
        return now.getTime() - expiresAt < EXPIRE_GRACE_MS;
      });

    const lastUpdatedAt = rows.reduce((max, row) => {
      return row.reported_at > max ? row.reported_at : max;
    }, room.updated_at || room.created_at);

    const { rows: nodePosRows } = await ctx.app.db.query<{ zone_id: string; x: number; y: number; features: any; custom_handles: any; rotation: number; explored: boolean; chain_id: string | null }>(
      'SELECT zone_id, x, y, features, custom_handles, rotation, explored, chain_id FROM room_node_positions WHERE room_id = $1',
      [ctx.roomId]
    );
    const nodePositions: NodePosition[] = nodePosRows.map((row) => ({
      zoneId: row.zone_id,
      x: row.x,
      y: row.y,
      features: row.features,
      customHandles: row.custom_handles,
      rotation: row.rotation ?? 0,
      explored: row.explored ?? false,
      chainId: row.chain_id ?? undefined,
    }));

    const { rows: memoryRows } = await ctx.app.db.query<{ zone_id: string; times_added: string[]; features: any; custom_handles: any; rotation: number; last_updated: string }>(
      'SELECT zone_id, times_added, features, custom_handles, rotation, last_updated FROM room_node_memory WHERE room_id = $1',
      [ctx.roomId]
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

    // The column is plain text, so guard against hand-edited/legacy values
    // rather than trusting the DB to hold a valid RoomServer.
    const server = ROOM_SERVERS.includes(room.server as RoomServer) ? (room.server as RoomServer) : undefined;

    ctx.send({ type: 'sync', connections, homeZoneId: room.home_zone_id, title: room.title || undefined, server, nodePositions, lastUpdatedAt, watching: getWatchingCount(ctx.roomId), totalConnected: getTotalSocketCount(), plottedRoute: room.plotted_route ?? undefined, plottedRouteFromZoneId: room.plotted_route_from_zone_id ?? undefined, plottedRouteToZoneId: room.plotted_route_to_zone_id ?? undefined, plottedRouteChainId: room.plotted_route_chain_id ?? undefined, chains, locked: room.locked ?? false });
    ctx.send({ type: 'memory_sync', memory });
  } catch {
    ctx.socket.close(4401, 'Invalid token');
  }
};
