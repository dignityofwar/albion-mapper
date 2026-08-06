import { ZONE_BY_ID, normalizeRotationSteps, canonicalizeHandlesForRotation, type NodePosition, type CustomHandle, type RoomMemoryEntry } from 'shared';
import { broadcast } from '../broadcast.js';
import { trackRoomModified } from '../routes/rooms_analytics.js';
import type { OperationHandler } from './types.js';
import type { ClientMessage } from 'shared';
import { safeRollback } from '../db_tx.js';

export const handleRotateZone: OperationHandler<Extract<ClientMessage, { type: 'rotate_zone' }>> = async (
  ctx,
  msg
) => {
  if (!ctx.authenticated) return;
  if (!(await ctx.verifyWriteAccess())) return;
  if (!msg.zoneId || typeof msg.rotation !== 'number') return;

  const targetRotation = normalizeRotationSteps(msg.rotation);
  const zone = ZONE_BY_ID.get(msg.zoneId);
  if (!zone) return;

  const dbClient = await ctx.app.db.connect();
  let updatedPosition: NodePosition | null = null;
  try {
    await dbClient.query('BEGIN');
    // Lock the room row to serialize concurrent rotation/update operations.
    const { rows: roomRows } = await dbClient.query<{ home_zone_id: string }>(
      'SELECT home_zone_id FROM rooms WHERE id = $1 FOR UPDATE',
      [ctx.roomId]
    );
    if (!roomRows[0]) {
      await dbClient.query('ROLLBACK');
      return;
    }

    const { rows: existingRows } = await dbClient.query<{ zone_id: string; x: number; y: number; features: any; custom_handles: any; rotation: number; explored: boolean; chain_id: string | null }>(
      'SELECT zone_id, x, y, features, custom_handles, rotation, explored, chain_id FROM room_node_positions WHERE room_id = $1 AND zone_id = $2',
      [ctx.roomId, msg.zoneId]
    );
    const existing = existingRows[0];
    if (!existing) {
      await dbClient.query('ROLLBACK');
      return;
    }

    // The client may send the handle set it wants persisted alongside the
    // rotation (the ZoneHandleEditor save path). When present it is the source
    // of truth; otherwise fall back to the stored handles (plain rotate /
    // reset / self-heal paths). Using the message handles is what makes the
    // editor save a single atomic operation — previously the client sent
    // rotate_zone followed by update_node_positions, and this handler would
    // read the not-yet-updated DB handles and echo the *stale* set back to
    // every client (including the sender, who was excluded from the later
    // update_node_positions broadcast and therefore kept the old portals
    // until a full reload).
    const incomingHandles = (msg.customHandles ?? existing.custom_handles ?? null) as CustomHandle[] | null;
    const canonicalHandles = canonicalizeHandlesForRotation(
      zone.type,
      zone.mapShape,
      incomingHandles,
      targetRotation,
    );

    await dbClient.query(
      'UPDATE room_node_positions SET rotation = $3, custom_handles = $4, explored = true WHERE room_id = $1 AND zone_id = $2',
      [ctx.roomId, msg.zoneId, targetRotation, JSON.stringify(canonicalHandles && canonicalHandles.length > 0 ? canonicalHandles : null)]
    );
    await dbClient.query(
      'UPDATE rooms SET updated_at = $1 WHERE id = $2',
      [new Date().toISOString(), ctx.roomId]
    );

    // Mirror the rotation/handles into room_node_memory (roads only),
    // so a future re-add of the same zone restores the rotated layout.
    // Upsert rather than UPDATE: a first-time hideout configuration has no
    // memory row yet, and an UPDATE would silently no-op.
    // Must use dbClient, not the pool: the room row is held FOR UPDATE above,
    // and this insert's FK check needs a lock on it — a second connection here
    // waits on a transaction that only commits once this query returns.
    if (zone.type === 'roads' || zone.type === 'roadsHideout') {
      const now = new Date().toISOString();
      await dbClient.query(`
        INSERT INTO room_node_memory (room_id, zone_id, features, custom_handles, rotation, last_updated, times_added)
        VALUES ($1, $2, NULL, $3, $4, $5, ARRAY[$5::timestamptz])
        ON CONFLICT (room_id, zone_id) DO UPDATE SET
          custom_handles = $3,
          rotation = EXCLUDED.rotation,
          last_updated = EXCLUDED.last_updated
      `, [
        ctx.roomId,
        msg.zoneId,
        JSON.stringify(canonicalHandles && canonicalHandles.length > 0 ? canonicalHandles : null),
        targetRotation,
        now,
      ]);
    }

    await dbClient.query('COMMIT');

    updatedPosition = {
      zoneId: existing.zone_id,
      x: existing.x,
      y: existing.y,
      features: existing.features,
      customHandles: canonicalHandles,
      rotation: targetRotation,
      explored: true,
      chainId: existing.chain_id ?? undefined,
    };
  } catch (e) {
    await safeRollback(dbClient);
    throw e;
  } finally {
    dbClient.release();
  }

  if (updatedPosition) {
    // Re-broadcast the authoritative state to every client (including the
    // sender) so any client that desynced will converge on the corrected
    // rotation/handles automatically.
    broadcast(ctx.roomId, {
      type: 'node_positions_updated',
      nodePositions: [updatedPosition],
      updateLastUpdated: true,
    });
    trackRoomModified(ctx.app.db, ctx.roomId);

    // Keep every client's memory view in sync with the mirror written above.
    if (zone.type === 'roads' || zone.type === 'roadsHideout') {
      const { rows: updatedMem } = await ctx.app.db.query<{ zone_id: string; times_added: string[]; features: any; custom_handles: any; rotation: number; last_updated: string }>(
        'SELECT zone_id, times_added, features, custom_handles, rotation, last_updated FROM room_node_memory WHERE room_id = $1 AND zone_id = $2',
        [ctx.roomId, msg.zoneId]
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
        broadcast(ctx.roomId, { type: 'memory_updated', entry });
      }
    }
  }
};
