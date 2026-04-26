import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import {
  CreateRoomBodySchema,
  AuthRoomBodySchema,
  UpdateRoomBodySchema,
  ChangePasswordBodySchema,
  ZONE_BY_ID,
} from 'shared';
import { broadcast } from '../broadcast.js';

const BCRYPT_ROUNDS = 12;

export async function roomRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/rooms — create a room
  app.post('/api/rooms', async (request, reply) => {
    const parsed = CreateRoomBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
    }

    const { password, adminPassword, homeZoneId } = parsed.data;

    const zone = ZONE_BY_ID.get(homeZoneId);
    if (!zone) {
      return reply.status(400).send({ error: 'homeZoneId not found in zone catalogue' });
    }

    if (!zone.isRoadsHome) {
      return reply.status(400).send({ error: 'homeZoneId is not a valid roads home' });
    }

    const id = nanoid(12);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const adminPasswordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
    const createdAt = new Date().toISOString();

    await app.db.query(`
      INSERT INTO rooms (id, password_hash, admin_password_hash, home_zone_id, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, passwordHash, adminPasswordHash, homeZoneId, createdAt]);

    const shareUrl = `${request.protocol}://${request.hostname}/rooms/${id}`;
    return reply.status(201).send({ id, shareUrl });
  });

  // POST /api/rooms/:id/auth — authenticate and get JWT
  app.post<{ Params: { id: string } }>('/api/rooms/:id/auth', async (request, reply) => {
    const { id } = request.params;
    const parsed = AuthRoomBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'password is required' });
    }

    const { rows } = await app.db.query<{ id: string; password_hash: string; home_zone_id: string; created_at: string }>(
      'SELECT id, password_hash, home_zone_id, created_at FROM rooms WHERE id = $1',
      [id]
    );
    const room = rows[0];

    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    const valid = await bcrypt.compare(parsed.data.password, room.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid password' });
    }

    const token = app.jwt.sign({ roomId: id }, { expiresIn: '24h' });
    return reply.send({ token });
  });

  // PATCH /api/rooms/:id — update home zone
  app.patch<{ Params: { id: string } }>('/api/rooms/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const jwtPayload = request.user as { roomId: string };

    if (jwtPayload.roomId !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const parsed = UpdateRoomBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
    }

    const { homeZoneId } = parsed.data;
    const zone = ZONE_BY_ID.get(homeZoneId);
    if (!zone) {
      return reply.status(400).send({ error: 'homeZoneId not found in zone catalogue' });
    }

    if (!zone.isRoadsHome) {
      return reply.status(400).send({ error: 'homeZoneId is not a valid roads home' });
    }

    const result = await app.db.query('UPDATE rooms SET home_zone_id = $1, updated_at = $2 WHERE id = $3', [homeZoneId, new Date().toISOString(), id]);
    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    broadcast(id, { type: 'room_updated', homeZoneId });
    return reply.send({ homeZoneId });
  });

  // PATCH /api/rooms/:id/password — change room password
  app.patch<{ Params: { id: string } }>('/api/rooms/:id/password', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const jwtPayload = request.user as { roomId: string };
    if (jwtPayload.roomId !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const parsed = ChangePasswordBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
    }
    const { newPassword, adminPassword } = parsed.data;
    
    // Check adminPassword
    const { rows } = await app.db.query<{ admin_password_hash: string }>(
      'SELECT admin_password_hash FROM rooms WHERE id = $1',
      [id]
    );
    const room = rows[0];
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }
    const validAdmin = await bcrypt.compare(adminPassword, room.admin_password_hash);
    if (!validAdmin) {
      return reply.status(401).send({ error: 'Invalid admin password' });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const result = await app.db.query(
      'UPDATE rooms SET password_hash = $1 WHERE id = $2',
      [passwordHash, id]
    );
    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'Room not found' });
    }
    return reply.send({ ok: true });
  });

  // DELETE /api/rooms/:id/connections — reset (delete all connections in room)
  app.delete<{ Params: { id: string }, Body: { adminPassword: string } }>('/api/rooms/:id/connections', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const { adminPassword } = request.body;
    const jwtPayload = request.user as { roomId: string };
    if (jwtPayload.roomId !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    // Check adminPassword
    const { rows: rooms } = await app.db.query<{ admin_password_hash: string }>(
      'SELECT admin_password_hash FROM rooms WHERE id = $1',
      [id]
    );
    const room = rooms[0];
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }
    const validAdmin = await bcrypt.compare(adminPassword, room.admin_password_hash);
    if (!validAdmin) {
      return reply.status(401).send({ error: 'Invalid admin password' });
    }

    await app.db.query('DELETE FROM connections WHERE room_id = $1', [id]);
    
    const { rows: rooms2 } = await app.db.query<{ home_zone_id: string }>(
      'SELECT home_zone_id FROM rooms WHERE id = $1',
      [id]
    );
    const roomWithHome = rooms2[0];
    await app.db.query('DELETE FROM room_node_positions WHERE room_id = $1 AND zone_id != $2', [id, roomWithHome.home_zone_id]);
    await app.db.query('UPDATE rooms SET updated_at = $1 WHERE id = $2', [new Date().toISOString(), id]);

    broadcast(id, { type: 'room_reset' });

    return reply.status(204).send();
  });
}
