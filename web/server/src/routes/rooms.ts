import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  CreateRoomBodySchema,
  AuthRoomBodySchema,
  AdminAuthRoomBodySchema,
  SetRoomLockBodySchema,
  SetRoomServerBodySchema,
  type RoomTokenPayload,
  ChangePasswordBodySchema,
  AddChainBodySchema,
  UpdateChainBodySchema,
  RelocateChainBodySchema,
  ImportRoomBodySchema,
  RenameRoomBodySchema,
  ZONE_BY_ID,
  defaultChainColor,
  PRIMARY_CHAIN_COLOR,
} from 'shared';
import { broadcast } from '../broadcast.js';
import { getInitialFeatures } from '../utils/nodeFeatures.js';
import { safeRollback } from '../db_tx.js';
import {
  trackRoomCreated,
  trackPasswordRotated,
  trackRoomReset,
  trackMemoryWipedFull,
  trackMemoryWipedSingle,
  trackRoomDeleted,
  trackRoomModified,
  trackTokenIssued,
} from './rooms_analytics.js';

const BCRYPT_ROUNDS = 12;

function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue.path.length > 0 ? issue.path.join('.') : 'body';
  return `Validation error at ${path}: ${issue.message}`;
}

export async function roomRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/rooms/resolve/:slug — kept for backward compatibility, returns the slug as-is
  app.get<{ Params: { slug: string } }>('/api/rooms/resolve/:slug', async (request, reply) => {
    const { slug } = request.params;
    const { rows } = await app.db.query<{ id: string }>(
      'SELECT id FROM rooms WHERE id = $1',
      [slug]
    );
    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Room not found' });
    }
    return reply.send({ id: rows[0].id });
  });

  // GET /api/slugs/check/:slug — check if a vanity URL slug is available
  app.get<{ Params: { slug: string } }>('/api/slugs/check/:slug', async (request, reply) => {
    const { slug } = request.params;
    if (!/^[a-z0-9-]+$/.test(slug) || slug.length < 1 || slug.length > 100) {
      return reply.status(400).send({ error: 'Invalid slug format' });
    }
    const { rows } = await app.db.query<{ id: string }>(
      'SELECT id FROM rooms WHERE id = $1',
      [slug]
    );
    return reply.send({ available: rows.length === 0 });
  });

  // POST /api/rooms — create a room
  app.post('/api/rooms', async (request, reply) => {
    const parsed = CreateRoomBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: formatZodError(parsed.error) });
    }

    const { password, adminPassword, homeZoneId, title, server, vanityUrl } = parsed.data;

    const zone = ZONE_BY_ID.get(homeZoneId);
    if (!zone) {
      return reply.status(400).send({ error: 'homeZoneId not found in zone catalogue' });
    }

    const id = vanityUrl;
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const adminPasswordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
    const createdAt = new Date().toISOString();

    const client = await app.db.connect();
    try {
      await client.query('BEGIN');
      const { rows: existing } = await client.query<{ id: string }>(
        'SELECT id FROM rooms WHERE id = $1',
        [id]
      );
      if (existing.length > 0) {
        await client.query('ROLLBACK');
        return reply.status(409).send({ error: 'Vanity URL is already taken' });
      }

      await client.query(`
        INSERT INTO rooms (id, password_hash, admin_password_hash, home_zone_id, title, server, created_at, chain_migrated)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      `, [id, passwordHash, adminPasswordHash, homeZoneId, title || null, server ?? null, createdAt]);

      // Seed the primary chain for the new room
      const primaryChainId = nanoid();
      await client.query(
        'INSERT INTO room_chains (id, room_id, source_zone_id, created_at, chain_number, chain_color) VALUES ($1, $2, $3, $4, $5, $6)',
        [primaryChainId, id, homeZoneId, createdAt, 1, PRIMARY_CHAIN_COLOR]
      );

      await client.query(`
        INSERT INTO room_node_positions (room_id, zone_id, x, y, features, custom_handles, rotation, chain_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [id, homeZoneId, 0, 0, JSON.stringify(getInitialFeatures(homeZoneId)), JSON.stringify(null), 0, primaryChainId]);

      await client.query(`
        INSERT INTO room_node_memory (room_id, zone_id, features, times_added, rotation)
        VALUES ($1, $2, $3, ARRAY[$4::timestamptz], $5)
      `, [id, homeZoneId, JSON.stringify(getInitialFeatures(homeZoneId)), createdAt, 0]);

      await client.query('COMMIT');
    } catch (e) {
      await safeRollback(client);
      throw e;
    } finally {
      client.release();
    }

    trackRoomCreated(app.db);

    const shareUrl = `${request.protocol}://${request.hostname}/rooms/${id}`;
    return reply.status(201).send({ id, shareUrl });
  });

  // POST /api/rooms/:id/auth — authenticate and get JWT
  app.post<{ Params: { id: string } }>('/api/rooms/:id/auth', async (request, reply) => {
    const { id } = request.params;
    const parsed = AuthRoomBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: formatZodError(parsed.error) });
    }

    const { rows } = await app.db.query<{ id: string; password_hash: string; home_zone_id: string; created_at: string; password_version: number }>(
      'SELECT id, password_hash, home_zone_id, created_at, password_version FROM rooms WHERE id = $1',
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

    const token = app.jwt.sign({ roomId: room.id, passwordVersion: room.password_version ?? 1 }, { expiresIn: '7d' });
    trackTokenIssued(app.db, room.id);
    return reply.send({ token });
  });

  // POST /api/rooms/:id/auth/admin — verify the ADMIN password and issue an
  // admin-role JWT. Mirrors /auth but compares ONLY against
  // admin_password_hash: the regular room password must never mint an admin
  // token. The query is scoped to the URL's room id, so another room's admin
  // password can never authenticate here. The `role: 'admin'` claim is the
  // sole source of admin rights and is only ever set on this signing path.
  app.post<{ Params: { id: string } }>('/api/rooms/:id/auth/admin', {
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const { id } = request.params;
    const parsed = AdminAuthRoomBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: formatZodError(parsed.error) });
    }

    const { rows } = await app.db.query<{ id: string; admin_password_hash: string; password_version: number | null }>(
      'SELECT id, admin_password_hash, password_version FROM rooms WHERE id = $1',
      [id]
    );
    const room = rows[0];
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    const valid = await bcrypt.compare(parsed.data.adminPassword, room.admin_password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid admin password' });
    }

    const payload: RoomTokenPayload = { roomId: room.id, passwordVersion: room.password_version ?? 1, role: 'admin' };
    const token = app.jwt.sign(payload, { expiresIn: '7d' });
    trackTokenIssued(app.db, room.id);
    return reply.send({ token });
  });

  // PATCH /api/rooms/:id/lock — lock or unlock the room. Requires an
  // admin-role token even when the room is unlocked (locking is admin-only);
  // while locked, the authenticate preHandler already blocks every other
  // mutating request from non-admin tokens.
  app.patch<{ Params: { id: string } }>('/api/rooms/:id/lock', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const jwtPayload = request.user as RoomTokenPayload;
    if (jwtPayload.roomId !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    if (jwtPayload.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin token required' });
    }
    const parsed = SetRoomLockBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: formatZodError(parsed.error) });
    }

    const result = await app.db.query(
      'UPDATE rooms SET locked = $1 WHERE id = $2',
      [parsed.data.locked, id]
    );
    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    broadcast(id, { type: 'room_lock_changed', locked: parsed.data.locked });

    return reply.send({ ok: true, locked: parsed.data.locked });
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
      return reply.status(400).send({ error: formatZodError(parsed.error) });
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
      'UPDATE rooms SET password_hash = $1, password_version = COALESCE(password_version, 1) + 1 WHERE id = $2',
      [passwordHash, id]
    );
    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    // Immediately boot all active WebSocket clients in this room
    broadcast(id, { type: 'password_rotated' });
    trackPasswordRotated(app.db);

    return reply.send({ ok: true });
  });

  // PATCH /api/rooms/:id/title — rename the room (requires admin password)
  app.patch<{ Params: { id: string } }>('/api/rooms/:id/title', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const jwtPayload = request.user as { roomId: string };
    if (jwtPayload.roomId !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const parsed = RenameRoomBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: formatZodError(parsed.error) });
    }
    const { title, adminPassword } = parsed.data;

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

    const result = await app.db.query(
      'UPDATE rooms SET title = $1 WHERE id = $2',
      [title || null, id]
    );
    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    broadcast(id, { type: 'room_title_updated', title: title || '' });
    trackRoomModified(app.db, id);

    return reply.send({ ok: true, title: title || '' });
  });

  // PATCH /api/rooms/:id/server — set which Albion server the room maps.
  //
  // Asymmetric auth by design: the FIRST assignment needs only a room token, so
  // the in-room prompt can backfill the rooms that predate this column without
  // an admin-password wall. Once a room carries a server, CHANGING it requires
  // the admin password — the value is analytics data and a silent flip would
  // poison it. Re-sending the current value is a no-op and stays open.
  app.patch<{ Params: { id: string } }>('/api/rooms/:id/server', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const jwtPayload = request.user as RoomTokenPayload;
    if (jwtPayload.roomId !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const parsed = SetRoomServerBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: formatZodError(parsed.error) });
    }
    const { server, adminPassword } = parsed.data;

    const { rows } = await app.db.query<{ server: string | null; admin_password_hash: string }>(
      'SELECT server, admin_password_hash FROM rooms WHERE id = $1',
      [id]
    );
    const room = rows[0];
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    if (room.server && room.server !== server) {
      if (!adminPassword) {
        return reply.status(400).send({ error: 'Admin password is required to change the room server' });
      }
      const validAdmin = await bcrypt.compare(adminPassword, room.admin_password_hash);
      if (!validAdmin) {
        return reply.status(401).send({ error: 'Invalid admin password' });
      }
    }

    const result = await app.db.query(
      'UPDATE rooms SET server = $1 WHERE id = $2',
      [server, id]
    );
    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    broadcast(id, { type: 'room_server_updated', server });
    trackRoomModified(app.db, id);

    return reply.send({ ok: true, server });
  });

  // POST /api/rooms/:id/chains — add a new chain rooted at sourceZoneId
  app.post<{ Params: { id: string } }>('/api/rooms/:id/chains', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const jwtPayload = request.user as { roomId: string };
    if (jwtPayload.roomId !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const parsed = AddChainBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: formatZodError(parsed.error) });
    }
    const { sourceZoneId, x: requestedX, y: requestedY } = parsed.data;
    const initialX = typeof requestedX === 'number' ? requestedX : 0;
    const initialY = typeof requestedY === 'number' ? requestedY : 0;

    const zone = ZONE_BY_ID.get(sourceZoneId);
    if (!zone) {
      return reply.status(400).send({ error: 'sourceZoneId not found in zone catalogue' });
    }

    const { rows: roomRows } = await app.db.query<{ id: string }>(
      'SELECT id FROM rooms WHERE id = $1',
      [id]
    );
    if (!roomRows[0]) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    // Reject if this zone already belongs to a chain in this room
    const { rows: existingNode } = await app.db.query<{ chain_id: string | null }>(
      'SELECT chain_id FROM room_node_positions WHERE room_id = $1 AND zone_id = $2',
      [id, sourceZoneId]
    );
    if (existingNode[0] && existingNode[0].chain_id) {
      return reply.status(409).send({ error: 'Zone is already part of an existing chain' });
    }

    const chainId = nanoid();
    const createdAt = new Date().toISOString();
    let insertedNode = false;
    let chainNumber = 1;
    let chainColor: string = PRIMARY_CHAIN_COLOR;

    const client = await app.db.connect();
    try {
      await client.query('BEGIN');

      // Compute the next chain_number for this room (MAX + 1, defaulting to
      // 1 for the very first chain — though primary is normally seeded at
      // room creation, room_reset/imports may leave gaps).
      const { rows: maxRows } = await client.query<{ max: number | null }>(
        'SELECT MAX(chain_number) AS max FROM room_chains WHERE room_id = $1',
        [id]
      );
      chainNumber = (maxRows[0]?.max ?? 0) + 1;
      chainColor = defaultChainColor(chainNumber);

      await client.query(
        'INSERT INTO room_chains (id, room_id, source_zone_id, created_at, chain_number, chain_color) VALUES ($1, $2, $3, $4, $5, $6)',
        [chainId, id, sourceZoneId, createdAt, chainNumber, chainColor]
      );

      if (existingNode.length === 0) {
        await client.query(
          'INSERT INTO room_node_positions (room_id, zone_id, x, y, features, custom_handles, rotation, chain_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [id, sourceZoneId, initialX, initialY, JSON.stringify(getInitialFeatures(sourceZoneId)), JSON.stringify(null), 0, chainId]
        );
        await client.query(
          'INSERT INTO room_node_memory (room_id, zone_id, features, times_added, rotation) VALUES ($1, $2, $3, ARRAY[$4::timestamptz], $5) ON CONFLICT (room_id, zone_id) DO NOTHING',
          [id, sourceZoneId, JSON.stringify(getInitialFeatures(sourceZoneId)), createdAt, 0]
        );
        insertedNode = true;
      } else {
        // Backfill chain_id on the existing isolated node row
        await client.query(
          'UPDATE room_node_positions SET chain_id = $1 WHERE room_id = $2 AND zone_id = $3',
          [chainId, id, sourceZoneId]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await safeRollback(client);
      throw e;
    } finally {
      client.release();
    }

    broadcast(id, { type: 'chain_added', chain: { id: chainId, sourceZoneId, chainNumber, chainColor } });

    if (insertedNode) {
      // Only broadcast the newly inserted source node — re-broadcasting ALL
      // positions would risk clobbering other clients' authoritative state
      // (and any in-flight optimistic updates) for preexisting zones. The
      // client merge handler upserts by zoneId so a single-row broadcast
      // appends the new node without touching existing ones.
      const { rows: nodePosRows } = await app.db.query<{ zone_id: string; x: number; y: number; features: any; custom_handles: any; rotation: number; explored: boolean; chain_id: string | null }>(
        'SELECT zone_id, x, y, features, custom_handles, rotation, explored, chain_id FROM room_node_positions WHERE room_id = $1 AND zone_id = $2',
        [id, sourceZoneId]
      );
      const nodePositions = nodePosRows.map((row) => ({
        zoneId: row.zone_id,
        x: row.x,
        y: row.y,
        features: row.features,
        customHandles: row.custom_handles,
        rotation: row.rotation ?? 0,
        explored: row.explored ?? false,
        chainId: row.chain_id ?? undefined,
      }));
      broadcast(id, { type: 'node_positions_updated', nodePositions });
    }

    trackRoomModified(app.db, id);

    return reply.status(201).send({ chain: { id: chainId, sourceZoneId, chainNumber, chainColor } });
  });

  // PATCH /api/rooms/:id/chains/:chainId — update mutable chain fields (currently colour).
  app.patch<{ Params: { id: string; chainId: string } }>('/api/rooms/:id/chains/:chainId', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id, chainId } = request.params;
    const jwtPayload = request.user as { roomId: string };
    if (jwtPayload.roomId !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const parsed = UpdateChainBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: formatZodError(parsed.error) });
    }

    const { chainColor } = parsed.data;

    const { rows } = await app.db.query<{ id: string; source_zone_id: string; chain_number: number; chain_color: string }>(
      `UPDATE room_chains SET chain_color = $1
       WHERE id = $2 AND room_id = $3
       RETURNING id, source_zone_id, chain_number, chain_color`,
      [chainColor, chainId, id]
    );
    if (!rows[0]) {
      return reply.status(404).send({ error: 'Chain not found' });
    }

    const chain = {
      id: rows[0].id,
      sourceZoneId: rows[0].source_zone_id,
      chainNumber: rows[0].chain_number,
      chainColor: rows[0].chain_color,
    };
    broadcast(id, { type: 'chain_updated', chain });
    trackRoomModified(app.db, id);

    return reply.send({ chain });
  });

  // POST /api/rooms/:id/chains/:chainId/relocate — wipe the chain and move its
  // source to a new zone. Deletes all connections, non-source node positions
  // and zone memory belonging to the chain, then sets the new source zone.
  // For the primary chain, also updates `rooms.home_zone_id`.
  app.post<{ Params: { id: string; chainId: string } }>('/api/rooms/:id/chains/:chainId/relocate', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id, chainId } = request.params;
    const jwtPayload = request.user as { roomId: string };
    if (jwtPayload.roomId !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const parsed = RelocateChainBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: formatZodError(parsed.error) });
    }
    const { sourceZoneId: newSourceZoneId } = parsed.data;

    const zone = ZONE_BY_ID.get(newSourceZoneId);
    if (!zone) {
      return reply.status(400).send({ error: 'sourceZoneId not found in zone catalogue' });
    }

    const { rows: roomRows } = await app.db.query<{ home_zone_id: string }>(
      'SELECT home_zone_id FROM rooms WHERE id = $1',
      [id]
    );
    const room = roomRows[0];
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    const { rows: chainRows } = await app.db.query<{ id: string; source_zone_id: string; chain_number: number; chain_color: string }>(
      'SELECT id, source_zone_id, chain_number, chain_color FROM room_chains WHERE id = $1 AND room_id = $2',
      [chainId, id]
    );
    const chain = chainRows[0];
    if (!chain) {
      return reply.status(404).send({ error: 'Chain not found' });
    }
    const isPrimary = chain.source_zone_id === room.home_zone_id;

    // Reject if the new source zone already belongs to a *different* chain
    const { rows: existingNode } = await app.db.query<{ chain_id: string | null }>(
      'SELECT chain_id FROM room_node_positions WHERE room_id = $1 AND zone_id = $2',
      [id, newSourceZoneId]
    );
    if (existingNode[0] && existingNode[0].chain_id && existingNode[0].chain_id !== chainId) {
      return reply.status(409).send({ error: 'Zone is already part of an existing chain' });
    }

    let removedZoneIds: string[] = [];
    let removedConnectionIds: string[] = [];
    let newSourceX = 0;
    let newSourceY = 0;
    const updatedAt = new Date().toISOString();

    const client = await app.db.connect();
    try {
      await client.query('BEGIN');

      // Collect every connection that belongs to this chain (by chain_id),
      // plus include the zones each touches — this is what lets us catch
      // "isolated" zones whose `room_node_positions.chain_id` is NULL but
      // which were reachable via the chain's connection graph.
      const { rows: connRows } = await client.query<{ id: string; from_zone_id: string; to_zone_id: string }>(
        'SELECT id, from_zone_id, to_zone_id FROM connections WHERE room_id = $1 AND chain_id = $2',
        [id, chainId]
      );

      const { rows: posRows } = await client.query<{ zone_id: string }>(
        'SELECT zone_id FROM room_node_positions WHERE room_id = $1 AND chain_id = $2',
        [id, chainId]
      );
      // Remember the old source zone's position so the new source can be
      // placed instantly at the same spot (avoiding a jarring (0,0) jump).
      const { rows: oldSourceRows } = await client.query<{ x: number; y: number }>(
        'SELECT x, y FROM room_node_positions WHERE room_id = $1 AND zone_id = $2',
        [id, chain.source_zone_id]
      );
      newSourceX = oldSourceRows[0]?.x ?? 0;
      newSourceY = oldSourceRows[0]?.y ?? 0;
      const zoneSet = new Set<string>();
      for (const r of posRows) zoneSet.add(r.zone_id);
      for (const c of connRows) { zoneSet.add(c.from_zone_id); zoneSet.add(c.to_zone_id); }
      zoneSet.add(chain.source_zone_id);
      // Don't delete the new source zone (it would be re-inserted below anyway).
      zoneSet.delete(newSourceZoneId);
      removedZoneIds = Array.from(zoneSet);

      // Delete connections by chain_id AND by zone membership, so orphan rows
      // (chain_id NULL) connecting these zones also get cleaned up.
      const { rows: deletedConns } = await client.query<{ id: string }>(
        `DELETE FROM connections
         WHERE room_id = $1
           AND (chain_id = $2
                OR ($3::text[] IS NOT NULL AND (from_zone_id = ANY($3::text[]) OR to_zone_id = ANY($3::text[]))))
         RETURNING id`,
        [id, chainId, removedZoneIds.length > 0 ? removedZoneIds : null]
      );
      removedConnectionIds = deletedConns.map((r) => r.id);

      if (removedZoneIds.length > 0) {
        // Positions only — map history (room_node_memory) is preserved and
        // only ever deleted via the explicit memory endpoints.
        await client.query(
          'DELETE FROM room_node_positions WHERE room_id = $1 AND zone_id = ANY($2::text[])',
          [id, removedZoneIds]
        );
      }

      // Insert the new source node position at the *old* source's coords so the
      // relocation is visually instant (no jump to origin).
      await client.query(
        'INSERT INTO room_node_positions (room_id, zone_id, x, y, features, custom_handles, rotation, chain_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [id, newSourceZoneId, newSourceX, newSourceY, JSON.stringify(getInitialFeatures(newSourceZoneId)), JSON.stringify(null), 0, chainId]
      );
      await client.query(
        'INSERT INTO room_node_memory (room_id, zone_id, features, times_added, rotation) VALUES ($1, $2, $3, ARRAY[$4::timestamptz], $5) ON CONFLICT (room_id, zone_id) DO NOTHING',
        [id, newSourceZoneId, JSON.stringify(getInitialFeatures(newSourceZoneId)), updatedAt, 0]
      );

      await client.query(
        'UPDATE room_chains SET source_zone_id = $1 WHERE id = $2 AND room_id = $3',
        [newSourceZoneId, chainId, id]
      );

      if (isPrimary) {
        await client.query('UPDATE rooms SET home_zone_id = $1 WHERE id = $2', [newSourceZoneId, id]);
      }

      await client.query('UPDATE rooms SET updated_at = $1 WHERE id = $2', [updatedAt, id]);

      await client.query('COMMIT');
    } catch (e) {
      await safeRollback(client);
      throw e;
    } finally {
      client.release();
    }

    const updatedChain = {
      id: chain.id,
      sourceZoneId: newSourceZoneId,
      chainNumber: chain.chain_number,
      chainColor: chain.chain_color,
    };
    const newSourceNodePosition = {
      zoneId: newSourceZoneId,
      x: newSourceX,
      y: newSourceY,
      features: getInitialFeatures(newSourceZoneId),
      customHandles: undefined,
      rotation: 0,
      explored: false,
      chainId,
    };

    broadcast(id, {
      type: 'chain_relocated',
      chain: updatedChain,
      removedZoneIds,
      removedConnectionIds,
      newHomeZoneId: isPrimary ? newSourceZoneId : undefined,
      newSourceNodePosition,
    });
    trackRoomModified(app.db, id);

    return reply.send({ chain: updatedChain, newSourceNodePosition, newHomeZoneId: isPrimary ? newSourceZoneId : undefined });
  });

  // DELETE /api/rooms/:id/chains/:chainId — remove a chain and all its zones/connections
  app.delete<{ Params: { id: string; chainId: string } }>('/api/rooms/:id/chains/:chainId', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id, chainId } = request.params;
    const jwtPayload = request.user as { roomId: string };
    if (jwtPayload.roomId !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { rows: roomRows } = await app.db.query<{ home_zone_id: string }>(
      'SELECT home_zone_id FROM rooms WHERE id = $1',
      [id]
    );
    const room = roomRows[0];
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    const { rows: chainRows } = await app.db.query<{ id: string; source_zone_id: string }>(
      'SELECT id, source_zone_id FROM room_chains WHERE id = $1 AND room_id = $2',
      [chainId, id]
    );
    const chain = chainRows[0];
    if (!chain) {
      return reply.status(404).send({ error: 'Chain not found' });
    }
    if (chain.source_zone_id === room.home_zone_id) {
      return reply.status(400).send({ error: 'Cannot delete the primary chain' });
    }

    // The whole chain goes in ONE statement: its connections (including any
    // whose `chain_id` was never set but which touch the chain's zones — the
    // same sweep `relocate` does, otherwise those rows survive as ghosts on
    // the map), then its node positions, the chain row and the room's
    // updated_at. Deleting by zone membership as well as by `chain_id` is why
    // the guards below matter: a position is only ever removed if it belongs
    // to *this* chain or to none, and never if it is the home zone or another
    // chain's source — see the `protected` CTE for why guarding the DELETE
    // alone is not sufficient. Map history (room_node_memory) is untouched —
    // it is only ever deleted via the explicit memory endpoints.
    const { rows: resultRows } = await app.db.query<{ removed_connection_ids: string[]; removed_zone_ids: string[] }>(
      `WITH protected AS (
         -- Rows that must outlive the chain even if they wrongly carry its id.
         -- Guarding them in the DELETE below is not enough: the chain row's FK
         -- is ON DELETE CASCADE, so anything still pointing at it when the row
         -- goes is removed silently and never makes the broadcast. Severing the
         -- link first is what actually protects them.
         UPDATE room_node_positions p
            SET chain_id = NULL
          WHERE p.room_id = $1
            AND p.chain_id = $2
            AND (p.zone_id = (SELECT home_zone_id FROM rooms WHERE id = $1)
                 OR EXISTS (
                   SELECT 1 FROM room_chains rc
                    WHERE rc.room_id = $1 AND rc.id <> $2 AND rc.source_zone_id = p.zone_id
                 ))
         RETURNING p.zone_id
       ),
       chain_zones AS (
         -- Protected zones are excluded here too: every CTE reads the same
         -- pre-UPDATE snapshot, so without this a protected zone would still
         -- count as chain membership and the sweep below would delete the
         -- *other* chain's connections that touch it.
         SELECT zone_id FROM room_node_positions
          WHERE room_id = $1 AND chain_id = $2
            AND zone_id NOT IN (SELECT zone_id FROM protected)
       ),
       deleted_conns AS (
         DELETE FROM connections c
          WHERE c.room_id = $1
            AND (c.chain_id = $2
                 OR c.from_zone_id IN (SELECT zone_id FROM chain_zones)
                 OR c.to_zone_id   IN (SELECT zone_id FROM chain_zones))
         RETURNING c.id, c.from_zone_id, c.to_zone_id
       ),
       doomed_zones AS (
         SELECT zone_id FROM chain_zones
         UNION SELECT $3::text
         UNION SELECT z.zone_id
                 FROM deleted_conns d
                 CROSS JOIN LATERAL (VALUES (d.from_zone_id), (d.to_zone_id)) AS z(zone_id)
       ),
       removed_positions AS (
         DELETE FROM room_node_positions p
          USING doomed_zones z
          WHERE p.room_id = $1
            AND p.zone_id = z.zone_id
            AND (p.chain_id = $2 OR p.chain_id IS NULL)
            AND p.zone_id NOT IN (SELECT zone_id FROM protected)
            AND p.zone_id <> (SELECT home_zone_id FROM rooms WHERE id = $1)
            AND NOT EXISTS (
              SELECT 1 FROM room_chains rc
               WHERE rc.room_id = $1 AND rc.id <> $2 AND rc.source_zone_id = p.zone_id
            )
         RETURNING p.zone_id
       ),
       deleted_chain AS (
         DELETE FROM room_chains WHERE id = $2 AND room_id = $1 RETURNING id
       ),
       updated_room AS (
         UPDATE rooms SET updated_at = $4 WHERE id = $1 RETURNING id
       )
       SELECT
         COALESCE((SELECT array_agg(id) FROM deleted_conns), '{}'::text[]) AS removed_connection_ids,
         COALESCE((SELECT array_agg(zone_id) FROM removed_positions), '{}'::text[]) AS removed_zone_ids`,
      [id, chainId, chain.source_zone_id, new Date().toISOString()]
    );

    const removedConnectionIds = resultRows[0]?.removed_connection_ids ?? [];
    const removedZoneIds = resultRows[0]?.removed_zone_ids ?? [];

    broadcast(id, { type: 'chain_removed', chainId, removedZoneIds, removedConnectionIds });
    trackRoomModified(app.db, id);

    return reply.status(204).send();
  });

  // DELETE /api/rooms/:id/connections — reset (delete all connections in room)
  app.delete<{ Params: { id: string }; Body: { adminPassword?: string } }>('/api/rooms/:id/connections', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const jwtPayload = request.user as { roomId: string };
    if (jwtPayload.roomId !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { adminPassword } = request.body ?? {};

    const client = await app.db.connect();
    try {
      await client.query('BEGIN');
      
      const { rows: rooms } = await client.query<{ admin_password_hash: string; home_zone_id: string }>(
        'SELECT admin_password_hash, home_zone_id FROM rooms WHERE id = $1 FOR UPDATE',
        [id]
      );
      const room = rooms[0];
      if (!room) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Room not found' });
      }

      if (adminPassword) {
        const validAdmin = await bcrypt.compare(adminPassword, room.admin_password_hash);
        if (!validAdmin) {
          await client.query('ROLLBACK');
          return reply.status(401).send({ error: 'Invalid admin password' });
        }
      }

      // Collect ALL chain source zones (which always includes the primary
      // chain's source == home_zone_id). These must NEVER be deleted, even by
      // a full room "reset" — otherwise we end up with the corrupt state of
      // a chain whose source zone no longer has a node position.
      const { rows: chainSourceRows } = await client.query<{ id: string; source_zone_id: string }>(
        'SELECT id, source_zone_id FROM room_chains WHERE room_id = $1',
        [id]
      );
      const preservedZoneIds = Array.from(new Set<string>([
        room.home_zone_id,
        ...chainSourceRows.map((r) => r.source_zone_id),
      ]));

      await client.query('DELETE FROM connections WHERE room_id = $1', [id]);
      await client.query(
        'DELETE FROM room_node_positions WHERE room_id = $1 AND zone_id <> ALL($2::text[])',
        [id, preservedZoneIds]
      );
      await client.query(
        'UPDATE room_node_positions SET features = $1, custom_handles = $2 WHERE room_id = $3 AND zone_id = ANY($4::text[])',
        ['{}', null, id, preservedZoneIds]
      );
      // Self-heal: for every chain, ensure its source zone has a node position
      // row with the correct chain_id. If the row is missing entirely (the
      // corrupt-room scenario), reconstruct it at (0,0); if it exists but has
      // a NULL/stale chain_id, repair it to match the chain. This guarantees
      // a reset always leaves every chain with its source zone properly
      // wired to a node position.
      for (const chain of chainSourceRows) {
        await client.query(
          `INSERT INTO room_node_positions (room_id, zone_id, x, y, features, custom_handles, chain_id)
           VALUES ($1, $2, 0, 0, '{}', NULL, $3)
           ON CONFLICT (room_id, zone_id) DO UPDATE SET chain_id = EXCLUDED.chain_id`,
          [id, chain.source_zone_id, chain.id]
        );
      }
      await client.query('UPDATE rooms SET updated_at = $1 WHERE id = $2', [new Date().toISOString(), id]);
      
      await client.query('COMMIT');
    } catch (e) {
      await safeRollback(client);
      throw e;
    } finally {
      client.release();
    }

    broadcast(id, { type: 'room_reset' });
    trackRoomReset(app.db);

    return reply.status(204).send();
  });

  // DELETE /api/rooms/:id/memory — flush all zone memory for a room
  app.delete<{ Params: { id: string }; Body: { adminPassword?: string } }>('/api/rooms/:id/memory', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const jwtPayload = request.user as { roomId: string };
    if (jwtPayload.roomId !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { adminPassword } = request.body ?? {};
    if (!adminPassword) {
      return reply.status(400).send({ error: 'Admin password required' });
    }
    const { rows } = await app.db.query<{ admin_password_hash: string }>(
      'SELECT admin_password_hash FROM rooms WHERE id = $1',
      [id]
    );
    if (!rows[0]) {
      return reply.status(404).send({ error: 'Room not found' });
    }
    const validAdmin = await bcrypt.compare(adminPassword, rows[0].admin_password_hash);
    if (!validAdmin) {
      return reply.status(401).send({ error: 'Invalid admin password' });
    }

    await app.db.query('DELETE FROM room_node_memory WHERE room_id = $1', [id]);

    broadcast(id, { type: 'memory_sync', memory: [] });
    trackMemoryWipedFull(app.db);

    return reply.status(204).send();
  });

  // DELETE /api/rooms/:id/memory/:zoneId — delete a single zone's memory
  app.delete<{ Params: { id: string; zoneId: string } }>('/api/rooms/:id/memory/:zoneId', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id, zoneId } = request.params;
    const jwtPayload = request.user as { roomId: string };
    if (jwtPayload.roomId !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    await app.db.query('DELETE FROM room_node_memory WHERE room_id = $1 AND zone_id = $2', [id, zoneId]);

    broadcast(id, { type: 'memory_deleted', zoneId });
    trackMemoryWipedSingle(app.db);

    return reply.status(204).send();
  });

  // DELETE /api/rooms/:id — permanently delete the room and all its data
  app.delete<{ Params: { id: string }; Body: { adminPassword: string } }>('/api/rooms/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const jwtPayload = request.user as { roomId: string };
    if (jwtPayload.roomId !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { adminPassword } = request.body ?? {};
    if (!adminPassword) {
      return reply.status(400).send({ error: 'Admin password required' });
    }

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

    const client = await app.db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM connections WHERE room_id = $1', [id]);
      await client.query('DELETE FROM room_node_positions WHERE room_id = $1', [id]);
      await client.query('DELETE FROM room_node_memory WHERE room_id = $1', [id]);
      await client.query('DELETE FROM rooms WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (e) {
      await safeRollback(client);
      throw e;
    } finally {
      client.release();
    }

    broadcast(id, { type: 'room_deleted' });
    trackRoomDeleted(app.db);

    return reply.status(204).send();
  });

  // PUT /api/rooms/:id/import — import full room state
  app.put<{ Params: { id: string }, Body: any }>('/api/rooms/:id/import', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const jwtPayload = request.user as { roomId: string };
    if (jwtPayload.roomId !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    
    const parsed = ImportRoomBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: formatZodError(parsed.error) });
    }

    const { homeZoneId, connections, nodePositions, roomHistory, chains: importedChains } = parsed.data;

    // Validate homeZoneId
    const zone = ZONE_BY_ID.get(homeZoneId);
    if (!zone) {
      return reply.status(400).send({ error: 'homeZoneId not found in zone catalogue' });
    }

    // Build the list of chains to materialize. If the export carried `chains`,
    // honour them (multi-chain round-trip); otherwise fall back to a single
    // primary chain rooted at homeZoneId (back-compat with pre-multi-chain
    // exports). The primary chain is always the one whose sourceZoneId matches
    // homeZoneId; if the import doesn't include such a chain we synthesize one.
    type ImportChain = { sourceZoneId: string };
    let chainsToCreate: ImportChain[] = [];
    if (importedChains && importedChains.length > 0) {
      const seen = new Set<string>();
      for (const c of importedChains) {
        if (!ZONE_BY_ID.get(c.sourceZoneId)) {
          return reply.status(400).send({ error: `chain sourceZoneId '${c.sourceZoneId}' not found in zone catalogue` });
        }
        if (seen.has(c.sourceZoneId)) {
          return reply.status(400).send({ error: `duplicate chain sourceZoneId '${c.sourceZoneId}'` });
        }
        seen.add(c.sourceZoneId);
        chainsToCreate.push({ sourceZoneId: c.sourceZoneId });
      }
      if (!seen.has(homeZoneId)) {
        // Ensure the primary chain (matching homeZoneId) always exists.
        chainsToCreate.unshift({ sourceZoneId: homeZoneId });
      }
    } else {
      chainsToCreate = [{ sourceZoneId: homeZoneId }];
    }

    // Derive zoneId → chainId membership by BFS from each chain's sourceZoneId
    // across the (undirected) connections graph. Cross-chain bridging is
    // forbidden, so the graph partitions cleanly. Primary chain claims first,
    // then the rest in order; orphan nodes default to the primary chain.
    const adjacency = new Map<string, Set<string>>();
    const addEdge = (a: string, b: string) => {
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      adjacency.get(a)!.add(b);
    };
    for (const c of connections) {
      addEdge(c.fromZoneId, c.toZoneId);
      addEdge(c.toZoneId, c.fromZoneId);
    }

    // Generate a stable id per chain up-front so we can reference it during
    // BFS without an extra DB round-trip.
    const chainIdBySource = new Map<string, string>();
    for (const c of chainsToCreate) {
      chainIdBySource.set(c.sourceZoneId, nanoid());
    }
    const primaryChainId = chainIdBySource.get(homeZoneId)!;

    const zoneChainId = new Map<string, string>();
    // Primary chain first.
    const orderedSources = [
      homeZoneId,
      ...chainsToCreate.map(c => c.sourceZoneId).filter(s => s !== homeZoneId),
    ];
    for (const source of orderedSources) {
      const chainId = chainIdBySource.get(source)!;
      if (zoneChainId.has(source)) continue; // shouldn't happen, but skip if claimed
      const queue: string[] = [source];
      zoneChainId.set(source, chainId);
      while (queue.length > 0) {
        const cur = queue.shift()!;
        const neighbours = adjacency.get(cur);
        if (!neighbours) continue;
        for (const n of neighbours) {
          if (zoneChainId.has(n)) continue;
          zoneChainId.set(n, chainId);
          queue.push(n);
        }
      }
    }
    const chainIdForZone = (zoneId: string): string => zoneChainId.get(zoneId) ?? primaryChainId;

    const client = await app.db.connect();
    try {
      await client.query('BEGIN');

      // Update room homeZoneId
      await client.query('UPDATE rooms SET home_zone_id = $1, updated_at = $2, chain_migrated = true WHERE id = $3', [homeZoneId, new Date().toISOString(), id]);

      // Delete all existing data
      await client.query('DELETE FROM connections WHERE room_id = $1', [id]);
      await client.query('DELETE FROM room_node_positions WHERE room_id = $1', [id]);
      await client.query('DELETE FROM room_node_memory WHERE room_id = $1', [id]);
      await client.query('DELETE FROM room_chains WHERE room_id = $1', [id]);

      // Insert chains (primary first for chronological consistency).
      const createdAt = new Date().toISOString();
      let importChainNumber = 0;
      for (const source of orderedSources) {
        importChainNumber += 1;
        await client.query(
          'INSERT INTO room_chains (id, room_id, source_zone_id, created_at, chain_number, chain_color) VALUES ($1, $2, $3, $4, $5, $6)',
          [chainIdBySource.get(source), id, source, createdAt, importChainNumber, defaultChainColor(importChainNumber)]
        );
      }

      // Insert new connections (chain_id derived from the from-zone's chain).
      for (const conn of connections) {
        await client.query(`
          INSERT INTO connections (id, room_id, from_zone_id, to_zone_id, from_handle_id, to_handle_id, expires_at, reported_at, reported_by, chain_id, permanent)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [nanoid(), id, conn.fromZoneId, conn.toZoneId, conn.fromHandleId, conn.toHandleId, conn.expiresAt, conn.reportedAt || new Date().toISOString(), conn.reportedBy || null, chainIdForZone(conn.fromZoneId), conn.permanent ?? false]);
      }

      // Insert new node positions (chain_id derived from the node's zone).
      for (const node of nodePositions) {
        await client.query(`
          INSERT INTO room_node_positions (room_id, zone_id, x, y, features, custom_handles, explored, rotation, chain_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [id, node.zoneId, node.x, node.y, JSON.stringify(node.features || {}), JSON.stringify(node.customHandles || null), !!node.explored, node.rotation ?? 0, chainIdForZone(node.zoneId)]);
      }

      // Insert new room memory (roads only)
      if (roomHistory) {
        for (const entry of roomHistory) {
          const zone = ZONE_BY_ID.get(entry.zoneId);
          if (zone?.type !== 'roads' && zone?.type !== 'roadsHideout') continue;

          await client.query(`
            INSERT INTO room_node_memory (room_id, zone_id, times_added, features, custom_handles, rotation, last_updated)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [id, entry.zoneId, entry.timesAdded, JSON.stringify(entry.features || {}), JSON.stringify(entry.customHandles || null), entry.rotation ?? 0, entry.lastUpdated]);
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await safeRollback(client);
      throw e;
    } finally {
      client.release();
    }
    
    broadcast(id, { type: 'room_reset' });
    trackRoomModified(app.db, id);

    return reply.status(204).send();
  });
}
