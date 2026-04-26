import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { CreateConnectionBodySchema, ZONE_BY_ID, getConnectionStatus } from 'shared';
import type { Connection } from 'shared';
import { broadcast } from '../broadcast.js';

interface DbConnection {
  id: string;
  room_id: string;
  from_zone_id: string;
  to_zone_id: string;
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
    expiresAt: row.expires_at,
    reportedAt: row.reported_at,
    reportedBy: row.reported_by ?? undefined,
  };
}

export async function connectionRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/rooms/:id/connections — list non-expired connections
  app.get<{ Params: { id: string } }>('/api/rooms/:id/connections', async (request, reply) => {
    const { id } = request.params;

    const room = app.db.prepare('SELECT id FROM rooms WHERE id = ?').get(id);
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    const rows = app.db
      .prepare('SELECT * FROM connections WHERE room_id = ?')
      .all(id) as DbConnection[];

    const now = new Date();
    const connections = rows
      .map(dbRowToConnection)
      .filter((c) => getConnectionStatus(c, now) !== 'expired');

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

    const room = app.db.prepare('SELECT id FROM rooms WHERE id = ?').get(id);
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    const parsed = CreateConnectionBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
    }

    const { fromZoneId, toZoneId, minutesRemaining, reportedBy } = parsed.data;

    if (fromZoneId === toZoneId) {
      return reply.status(400).send({ error: 'fromZoneId and toZoneId must be different' });
    }

    if (!ZONE_BY_ID.has(fromZoneId)) {
      return reply.status(400).send({ error: 'fromZoneId not found in zone catalogue' });
    }

    if (!ZONE_BY_ID.has(toZoneId)) {
      return reply.status(400).send({ error: 'toZoneId not found in zone catalogue' });
    }

    const now = new Date();
    const connId = randomUUID();
    const reportedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + minutesRemaining * 60 * 1000).toISOString();

    app.db.prepare(`
      INSERT INTO connections (id, room_id, from_zone_id, to_zone_id, expires_at, reported_at, reported_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(connId, id, fromZoneId, toZoneId, expiresAt, reportedAt, reportedBy ?? null);

    const connection: Connection = {
      id: connId,
      roomId: id,
      fromZoneId,
      toZoneId,
      expiresAt,
      reportedAt,
      reportedBy,
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

      const result = app.db
        .prepare('DELETE FROM connections WHERE id = ? AND room_id = ?')
        .run(connId, id);

      if (result.changes === 0) {
        return reply.status(404).send({ error: 'Connection not found' });
      }

      broadcast(id, { type: 'connection_removed', connectionId: connId });
      return reply.status(204).send();
    },
  );
}
