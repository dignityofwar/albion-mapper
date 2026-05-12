import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { CreateConnectionBodySchema, UpdateConnectionBodySchema, ZONE_BY_ID, getConnectionStatus } from 'shared';
import * as Shared from 'shared';
import type { Connection, NodePosition } from 'shared';
import { broadcast } from '../broadcast.js';
import { getInitialFeatures } from '../utils/nodeFeatures.js';

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

function dbRowToConnection(row: DbConnection): Connection {
  return {
    id: row.id,
    roomId: row.room_id,
    fromZoneId: row.from_zone_id,
    toZoneId: row.to_zone_id,
    fromHandleId: row.from_handle_id ?? undefined,
    toHandleId: row.to_handle_id ?? undefined,
    expiresAt: row.expires_at,
    reportedAt: row.reported_at,
    reportedBy: row.reported_by ?? undefined,
  };
}

export async function connectionRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/rooms/:id/connections — list non-expired connections
  app.get<{ Params: { id: string } }>('/api/rooms/:id/connections', async (request, reply) => {
    const { id } = request.params;

    const { rows: rooms } = await app.db.query('SELECT id FROM rooms WHERE id = $1', [id]);
    if (rooms.length === 0) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    const { rows } = await app.db.query<DbConnection>(
      'SELECT * FROM connections WHERE room_id = $1',
      [id]
    );

    const now = new Date();
    const EXPIRE_GRACE_MS = 6 * 60 * 60 * 1000;
    const connections = rows
      .map(dbRowToConnection)
      .filter((c) => {
        const expiresAt = new Date(c.expiresAt).getTime();
        return now.getTime() - expiresAt < EXPIRE_GRACE_MS;
      });

    return reply.send(connections);
  });

  // POST /api/rooms/:id/connections — create a connection
  app.post<{ Params: { id: string } }>('/api/rooms/:id/connections', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const jwtPayload = request.user as { roomId: string };

    if (jwtPayload.roomId !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { rows: rooms } = await app.db.query('SELECT id FROM rooms WHERE id = $1', [id]);
    if (rooms.length === 0) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    const parsed = CreateConnectionBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
    }

    const { fromZoneId, toZoneId, fromHandleId, toHandleId, secondsRemaining, slots, reportedBy, targetPosition } = parsed.data;

    if (fromZoneId === toZoneId) {
      return reply.status(400).send({ error: 'fromZoneId and toZoneId must be different' });
    }

    if (!ZONE_BY_ID.has(fromZoneId)) {
      return reply.status(400).send({ error: 'fromZoneId not found in zone catalogue' });
    }

    if (!ZONE_BY_ID.has(toZoneId)) {
      return reply.status(400).send({ error: 'toZoneId not found in zone catalogue' });
    }

    const { rows: dbConnections } = await app.db.query<DbConnection>(
      'SELECT * FROM connections WHERE room_id = $1',
      [id]
    );
    const connections = dbConnections.map(dbRowToConnection);
    if (Shared.wouldCreateCycle(connections, fromZoneId, toZoneId)) {
      return reply.status(400).send({ error: 'This connection would create a direct cycle' });
    }

    const now = new Date();
    const lastUpdateMs = now.getTime();

    // If target position is provided, save it (new node); otherwise just update slots on existing node
    if (targetPosition) {
      const initialFeatures = { ...getInitialFeatures(toZoneId), slots, lastUpdatedAt: lastUpdateMs };
      await app.db.query(`
        INSERT INTO room_node_positions (room_id, zone_id, x, y, features)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (room_id, zone_id) DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y, features = EXCLUDED.features
      `, [id, toZoneId, targetPosition.x, targetPosition.y, JSON.stringify(initialFeatures)]);
    } else {
      // No target position provided (connecting two existing nodes) — update slots and lastUpdatedAt on the target node
      await app.db.query(`
        UPDATE room_node_positions
        SET features = jsonb_set(
          jsonb_set(COALESCE(features, '{}'), '{slots}', $1::jsonb),
          '{lastUpdatedAt}', $2::jsonb
        )
        WHERE room_id = $3 AND zone_id = $4
      `, [JSON.stringify(slots), JSON.stringify(lastUpdateMs), id, toZoneId]);
    }

    // Update lastUpdatedAt for the source zone (fromZoneId)
    await app.db.query(`
      UPDATE room_node_positions
      SET features = jsonb_set(COALESCE(features, '{}'), '{lastUpdatedAt}', $1::jsonb)
      WHERE room_id = $2 AND zone_id = $3
    `, [JSON.stringify(lastUpdateMs), id, fromZoneId]);

    const { rows: positions } = await app.db.query<{ zone_id: string; x: number; y: number; features: any; custom_handles: any }>(
      'SELECT zone_id, x, y, features, custom_handles FROM room_node_positions WHERE room_id = $1',
      [id]
    );
    const nodePositions = positions.map(p => ({ 
      zoneId: p.zone_id, 
      x: p.x, 
      y: p.y,
      features: p.features,
      customHandles: p.custom_handles 
    }));
    
    broadcast(id, { type: 'node_positions_updated', nodePositions });

    const connId = randomUUID();
    const reportedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + secondsRemaining * 1000).toISOString();

    await app.db.query(`
      INSERT INTO connections (id, room_id, from_zone_id, to_zone_id, from_handle_id, to_handle_id, expires_at, reported_at, reported_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [connId, id, fromZoneId, toZoneId, fromHandleId ?? null, toHandleId ?? null, expiresAt, reportedAt, reportedBy ?? null]);

    const connection: Connection = {
      id: connId,
      roomId: id,
      fromZoneId,
      toZoneId,
      fromHandleId: fromHandleId ?? undefined,
      toHandleId: toHandleId ?? undefined,
      expiresAt,
      reportedAt,
      reportedBy: reportedBy ?? undefined,
    };

    broadcast(id, { type: 'connection_added', connection });
    return reply.status(201).send(connection);
  });


  // DELETE /api/rooms/:id/connections/:connId — delete a connection
  app.delete<{ Params: { id: string; connId: string } }>(
    '/api/rooms/:id/connections/:connId',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { id, connId } = request.params;
      const jwtPayload = request.user as { roomId: string };

      if (jwtPayload.roomId !== id) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { rows } = await app.db.query<{ from_zone_id: string; to_zone_id: string }>(
        'SELECT from_zone_id, to_zone_id FROM connections WHERE id = $1 AND room_id = $2',
        [connId, id]
      );
      const conn = rows[0];

      if (!conn) {
        return reply.status(404).send({ error: 'Connection not found' });
      }

      await app.db.query('DELETE FROM connections WHERE id = $1 AND room_id = $2', [connId, id]);

      const { rows: rooms } = await app.db.query<{ home_zone_id: string }>(
        'SELECT home_zone_id FROM rooms WHERE id = $1',
        [id]
      );
      const room = rooms[0];

      const zonesToCheck = [conn.from_zone_id, conn.to_zone_id];
      let positionsUpdated = false;

      for (const zoneId of zonesToCheck) {
        if (zoneId === room.home_zone_id) continue;

        const { rows: connections } = await app.db.query(
          'SELECT 1 FROM connections WHERE room_id = $1 AND (from_zone_id = $2 OR to_zone_id = $2)',
          [id, zoneId]
        );

        if (connections.length === 0) {
          const res = await app.db.query('DELETE FROM room_node_positions WHERE room_id = $1 AND zone_id = $2', [id, zoneId]);
          if ((res.rowCount ?? 0) > 0) {
            positionsUpdated = true;
          }
        }
      }

      broadcast(id, { type: 'connection_removed', connectionId: connId });

      if (positionsUpdated) {
        const { rows: positions } = await app.db.query<{ zone_id: string; x: number; y: number; features: any; custom_handles: any }>(
          'SELECT zone_id, x, y, features, custom_handles FROM room_node_positions WHERE room_id = $1',
          [id]
        );
        const nodePositions = positions.map(p => ({ 
          zoneId: p.zone_id, 
          x: p.x, 
          y: p.y,
          features: p.features,
          customHandles: p.custom_handles 
        }));
        
        broadcast(id, { type: 'node_positions_updated', nodePositions });
      }

      return reply.status(204).send();
    },
  );

  // DELETE /api/rooms/:id/nodes/:zoneId — delete an orphaned node position (no connections)
  app.delete<{ Params: { id: string; zoneId: string } }>(
    '/api/rooms/:id/nodes/:zoneId',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { id, zoneId } = request.params;
      const jwtPayload = request.user as { roomId: string };

      if (jwtPayload.roomId !== id) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { rows: rooms } = await app.db.query<{ home_zone_id: string }>(
        'SELECT home_zone_id FROM rooms WHERE id = $1',
        [id]
      );
      const room = rooms[0];
      if (!room) {
        return reply.status(404).send({ error: 'Room not found' });
      }

      if (zoneId === room.home_zone_id) {
        return reply.status(400).send({ error: 'Cannot delete the home zone' });
      }

      await app.db.query(
        'DELETE FROM room_node_positions WHERE room_id = $1 AND zone_id = $2',
        [id, zoneId]
      );

      const { rows: positions } = await app.db.query<{ zone_id: string; x: number; y: number; features: any; custom_handles: any }>(
        'SELECT zone_id, x, y, features, custom_handles FROM room_node_positions WHERE room_id = $1',
        [id]
      );
      const nodePositions = positions.map(p => ({
        zoneId: p.zone_id,
        x: p.x,
        y: p.y,
        features: p.features,
        customHandles: p.custom_handles,
      }));

      broadcast(id, { type: 'node_positions_updated', nodePositions });

      return reply.status(204).send();
    },
  );

  // PATCH /api/rooms/:id/connections/:connId — update a connection
  app.patch<{ Params: { id: string; connId: string } }>(
    '/api/rooms/:id/connections/:connId',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { id, connId } = request.params;
      const jwtPayload = request.user as { roomId: string };

      if (jwtPayload.roomId !== id) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { rows: roomRows } = await app.db.query<{ id: string }>(
        'SELECT id FROM rooms WHERE id = $1',
        [id]
      );
      if (roomRows.length === 0) {
        return reply.status(404).send({ error: 'Room not found' });
      }
      const actualId = id;

      const parsed = UpdateConnectionBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      }

      const { secondsRemaining, fromHandleId, toHandleId } = parsed.data;

      const { rows } = await app.db.query<{ id: string; from_zone_id: string; to_zone_id: string }>(
        'SELECT id, from_zone_id, to_zone_id FROM connections WHERE id = $1 AND room_id = $2',
        [connId, actualId]
      );
      const conn = rows[0];

      if (!conn) {
        return reply.status(404).send({ error: 'Connection not found' });
      }

      const now = new Date();
      const lastUpdateMs = now.getTime();
      
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (secondsRemaining !== undefined) {
        const expiresAt = new Date(now.getTime() + secondsRemaining * 1000).toISOString();
        updates.push(`expires_at = $${idx++}`);
        values.push(expiresAt);
      }
      
      if (fromHandleId !== undefined) {
        updates.push(`from_handle_id = $${idx++}`);
        values.push(fromHandleId);
      }
      
      if (toHandleId !== undefined) {
        updates.push(`to_handle_id = $${idx++}`);
        values.push(toHandleId);
      }

      if (updates.length > 0) {
        values.push(connId, actualId);
        await app.db.query(
          `UPDATE connections SET ${updates.join(', ')} WHERE id = $${idx++} AND room_id = $${idx++}`,
          values
        );

        // Update lastUpdatedAt for both zones involved in the connection
        await app.db.query(`
          UPDATE room_node_positions
          SET features = jsonb_set(COALESCE(features, '{}'), '{lastUpdatedAt}', $1::jsonb)
          WHERE room_id = $2 AND zone_id IN ($3, $4)
        `, [JSON.stringify(lastUpdateMs), actualId, conn.from_zone_id, conn.to_zone_id]);

        const { rows: positions } = await app.db.query<{ zone_id: string; x: number; y: number; features: any; custom_handles: any }>(
          'SELECT zone_id, x, y, features, custom_handles FROM room_node_positions WHERE room_id = $1',
          [actualId]
        );
        const nodePositions = positions.map(p => ({
          zoneId: p.zone_id,
          x: p.x,
          y: p.y,
          features: p.features,
          customHandles: p.custom_handles,
        }));

        broadcast(actualId, { type: 'node_positions_updated', nodePositions });
      }

      const { rows: updatedConns } = await app.db.query<DbConnection>(
        'SELECT * FROM connections WHERE id = $1 AND room_id = $2',
        [connId, actualId]
      );
      const updatedConn = updatedConns[0];

      const connection = dbRowToConnection(updatedConn);

      broadcast(actualId, { type: 'connection_updated', connection });
      return reply.send(connection);
    },
  );
}
