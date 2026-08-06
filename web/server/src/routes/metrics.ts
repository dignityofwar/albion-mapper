import type { FastifyInstance } from 'fastify';
import { ROOM_SERVERS } from 'shared';
import { londonDateString } from '../analytics.js';
import { getTotalSocketCount, getAllRoomSockets } from '../broadcast.js';
import { getDbIncidents } from '../db_incidents.js';

/**
 * Formats a single Prometheus metric block (HELP + TYPE + value line).
 */
function metric(name: string, help: string, type: 'gauge' | 'counter', value: number): string {
  return `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n${name} ${value}\n`;
}

/**
 * Formats a Prometheus metric block with multiple labeled series.
 */
function metricLabeled(name: string, help: string, type: 'gauge' | 'counter', series: { labels: Record<string, string>; value: number }[]): string {
  const labelStr = (labels: Record<string, string>) =>
    Object.entries(labels)
      .map(([k, v]) => `${k}="${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`)
      .join(',');
  const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`];
  for (const s of series) {
    lines.push(`${name}{${labelStr(s.labels)}} ${s.value}`);
  }
  return lines.join('\n') + '\n';
}

function isAllowedMetricsIp(ip: string): boolean {
  // Allow localhost and 10.0.1.0/24; Cloudflare tunnel on 10.0.5.0/24 is blocked
  if (ip === '127.0.0.1' || ip === '::1') return true;
  const parts = ip.split('.');
  return parts.length === 4 && parts[0] === '10' && parts[1] === '0' && parts[2] === '1';
}

export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/metrics', async (request, reply) => {
    const ip = request.ip;
    if (!isAllowedMetricsIp(ip)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    // --- Live in-process stats ---
    const totalConnections = getTotalSocketCount();
    const roomSockets = getAllRoomSockets();
    const liveRooms = roomSockets.size;

    // --- DB stats ---
    const { rows: roomRows } = await app.db.query<{ total: string; inactive: string; empty: string; expired: string; active: string; locked: string }>(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) - $1 AS inactive,
         COUNT(*) FILTER (WHERE id NOT IN (SELECT DISTINCT room_id FROM connections)) AS empty,
         COUNT(*) FILTER (WHERE id IN (SELECT DISTINCT room_id FROM connections) AND id NOT IN (SELECT DISTINCT room_id FROM connections WHERE expires_at > NOW())) AS expired,
         COUNT(*) FILTER (WHERE id IN (SELECT DISTINCT room_id FROM connections WHERE expires_at > NOW())) AS active,
         COUNT(*) FILTER (WHERE locked) AS locked
       FROM rooms`,
      [liveRooms],
    );
    const totalRooms = parseInt(roomRows[0]?.total ?? '0', 10);
    const inactiveRooms = Math.max(0, parseInt(roomRows[0]?.inactive ?? '0', 10));
    const emptyRooms = parseInt(roomRows[0]?.empty ?? '0', 10);
    const expiredRooms = parseInt(roomRows[0]?.expired ?? '0', 10);
    const activeRooms = parseInt(roomRows[0]?.active ?? '0', 10);
    const lockedRooms = parseInt(roomRows[0]?.locked ?? '0', 10);

    // --- Locked rooms by ID ---
    const { rows: lockedRoomRows } = await app.db.query<{ room_id: string }>(
      'SELECT id AS room_id FROM rooms WHERE locked ORDER BY id',
    );

    // --- Rooms with a currently plotted route (live state; plotted_route is
    // nulled when the route is cleared). Only counts routes that are still
    // ACTIVE: plotted_route_expires_at is snapshotted at plot time as the
    // route's soonest-expiring leg, so a simple timestamp check suffices —
    // plotted_route itself is not cleared server-side when connections expire. ---
    const { rows: routePlottedRoomRows } = await app.db.query<{ room_id: string }>(
      `SELECT id AS room_id
       FROM rooms
       WHERE COALESCE(array_length(plotted_route, 1), 0) > 0
         AND plotted_route_expires_at > NOW()
       ORDER BY id`,
    );

    // --- Latest hourly connection stats from DB ---
    // avg_connections is the mean of all per-minute scrape samples recorded in that hour bucket
    const { rows: hourlyRows } = await app.db.query<{
      hour: string;
      max_connections: string;
      min_connections: string;
      avg_connections: string;
    }>(
      `SELECT hour, max_connections, min_connections, avg_connections
       FROM analytics_hourly_connections
       ORDER BY hour DESC
       LIMIT 1`,
    );
    const lastHourMax = parseInt(hourlyRows[0]?.max_connections ?? '0', 10);
    const lastHourMin = parseInt(hourlyRows[0]?.min_connections ?? '0', 10);
    const lastHourAvg = parseFloat(hourlyRows[0]?.avg_connections ?? '0');

    // --- All hourly buckets for hour-of-day activity chart ---
    // Returns one row per hour bucket recorded, used to build a labelled series
    // so Grafana can aggregate by Europe/London hour across multiple days.
    // We aggregate by the hour component (0-23) across all days to produce a single series.
    const { rows: allHourlyRows } = await app.db.query<{
      hour_of_day: number;
      avg_connections: string;
    }>(
      `SELECT EXTRACT(HOUR FROM hour) AS hour_of_day,
              SUM(avg_connections * sample_count) / NULLIF(SUM(sample_count), 0) AS avg_connections
       FROM analytics_hourly_connections
       GROUP BY hour_of_day
       ORDER BY hour_of_day ASC`,
    );

    // Today's global daily stats (Europe/London) ---
    const today = londonDateString();
    const { rows: dailyRows } = await app.db.query<{
      rooms_created: string;
      rooms_modified: string;
      rooms_reset: string;
      rooms_deleted: string;
      rooms_aborted: string;
      rooms_abandoned: string;
      memory_wiped_full: string;
      memory_wiped_single: string;
      passwords_rotated: string;
      peak_concurrent: string;
      unique_tokens_active: string;
      zones_added: string;
      non_roads_zones_added: string;
      room_data_updates: string;
      routes_plotted: string;
      tokens_issued: string;
    }>(
      `SELECT
         rooms_created, rooms_modified, rooms_reset, rooms_deleted,
         rooms_aborted, rooms_abandoned,
         memory_wiped_full, memory_wiped_single, passwords_rotated,
         peak_concurrent, unique_tokens_active,
         zones_added, non_roads_zones_added, room_data_updates, routes_plotted, tokens_issued
       FROM analytics_global_daily
       WHERE date = $1`,
      [today],
    );
    const daily = dailyRows[0];

    // --- All-time cumulative stats ---
    const { rows: alltimeRows } = await app.db.query<{
      alltime_peak: string;
      alltime_avg: string;
    }>(
      `SELECT
         COALESCE(MAX(max_connections), 0) AS alltime_peak,
         COALESCE(
           SUM(avg_connections * sample_count) / NULLIF(SUM(sample_count), 0),
           0
         ) AS alltime_avg
       FROM analytics_hourly_connections`
    );
    const alltimePeak = parseInt(alltimeRows[0]?.alltime_peak ?? '0', 10);
    const alltimeAvg = parseFloat(alltimeRows[0]?.alltime_avg ?? '0');

    const { rows: alltimeGlobalRows } = await app.db.query<{
      tokens_issued: string;
      room_data_updates: string;
      routes_plotted: string;
      rooms_created: string;
      rooms_modified: string;
      rooms_reset: string;
      rooms_deleted: string;
    }>(
      `SELECT
         SUM(tokens_issued) AS tokens_issued,
         SUM(room_data_updates) AS room_data_updates,
         SUM(routes_plotted) AS routes_plotted,
         SUM(rooms_created) AS rooms_created,
         SUM(rooms_modified) AS rooms_modified,
         SUM(rooms_reset) AS rooms_reset,
         SUM(rooms_deleted) AS rooms_deleted
       FROM analytics_global_daily`,
    );
    const totalTokensIssued = parseInt(alltimeGlobalRows[0]?.tokens_issued ?? '0', 10);
    const totalRoomDataUpdates = parseInt(alltimeGlobalRows[0]?.room_data_updates ?? '0', 10);
    const totalRoutesPlotted = parseInt(alltimeGlobalRows[0]?.routes_plotted ?? '0', 10);
    const totalRoomsCreated = parseInt(alltimeGlobalRows[0]?.rooms_created ?? '0', 10);
    const totalRoomsModified = parseInt(alltimeGlobalRows[0]?.rooms_modified ?? '0', 10);
    const totalRoomsReset = parseInt(alltimeGlobalRows[0]?.rooms_reset ?? '0', 10);
    const totalRoomsDeleted = parseInt(alltimeGlobalRows[0]?.rooms_deleted ?? '0', 10);

    // --- All-time room cleanup stats ---
    const { rows: cleanupAlltimeRows } = await app.db.query<{
      rooms_aborted: string;
      rooms_abandoned: string;
    }>('SELECT rooms_aborted, rooms_abandoned FROM analytics_global_alltime WHERE id = 1');
    const totalRoomsAborted  = parseInt(cleanupAlltimeRows[0]?.rooms_aborted  ?? '0', 10);
    const totalRoomsAbandoned = parseInt(cleanupAlltimeRows[0]?.rooms_abandoned ?? '0', 10);

    const { rows: alltimeRoomRows } = await app.db.query<{ room_id: string; tokens_issued: string; data_updates: string; routes_plotted: string }>(
      'SELECT room_id, tokens_issued, data_updates, routes_plotted FROM analytics_room_alltime WHERE tokens_issued > 0 OR data_updates > 0 OR routes_plotted > 0',
    );

    // --- Last time a route was plotted. Exact timestamps come from
    // routes_last_plotted_at; plots predating that column fall back to the
    // daily routes_plotted buckets (day granularity, rendered as midnight UTC).
    // GREATEST ignores NULLs, so whichever source exists wins. ---
    const { rows: roomLastPlottedRows } = await app.db.query<{ room_id: string; last_plotted: string; last_epoch: string }>(
      `SELECT ra.room_id,
              to_char(GREATEST(ra.routes_last_plotted_at, d.max_date::timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London', 'YYYY-MM-DD"T"HH24:MI:SS') AS last_plotted,
              EXTRACT(EPOCH FROM GREATEST(ra.routes_last_plotted_at, d.max_date::timestamp AT TIME ZONE 'UTC'))::bigint AS last_epoch
       FROM analytics_room_alltime ra
       LEFT JOIN (
         SELECT room_id, MAX(date) AS max_date
         FROM analytics_room_daily
         WHERE routes_plotted > 0
         GROUP BY room_id
       ) d ON d.room_id = ra.room_id
       WHERE ra.routes_plotted > 0 OR ra.routes_last_plotted_at IS NOT NULL`,
    );
    const { rows: globalLastPlottedRows } = await app.db.query<{ last_epoch: string }>(
      `SELECT EXTRACT(EPOCH FROM GREATEST(
                (SELECT routes_last_plotted_at FROM analytics_global_alltime WHERE id = 1),
                (SELECT MAX(date)::timestamp AT TIME ZONE 'UTC' FROM analytics_global_daily WHERE routes_plotted > 0)
              ))::bigint AS last_epoch`,
    );
    const lastRoutePlottedEpoch = parseInt(globalLastPlottedRows[0]?.last_epoch ?? '0', 10);

    // --- Map History stats ---
    const { rows: mapHistoryRows } = await app.db.query<{ zone_id: string; total_mentions: string }>(
      `SELECT rnm.zone_id, COUNT(DISTINCT rnm.room_id) AS total_mentions
       FROM room_node_memory rnm
       JOIN rooms r ON r.id = rnm.room_id
       WHERE rnm.zone_id != r.home_zone_id
       GROUP BY rnm.zone_id`
    );

    const { rows: roomHistoryRows } = await app.db.query<{ room_id: string; total_entries: string }>(
      `SELECT rnm.room_id, COUNT(DISTINCT rnm.zone_id) AS total_entries
       FROM room_node_memory rnm
       JOIN rooms r ON r.id = rnm.room_id
       WHERE rnm.zone_id != r.home_zone_id
       GROUP BY rnm.room_id`
    );

    const { rows: totalHistoryRows } = await app.db.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM room_node_memory rnm
       JOIN rooms r ON r.id = rnm.room_id
       WHERE rnm.zone_id != r.home_zone_id`
    );
    const totalHistoryEntries = parseInt(totalHistoryRows[0]?.total ?? '0', 10);

    // --- Latest created rooms (top 10 by created_at) ---
    const { rows: latestRoomRows } = await app.db.query<{ room_id: string; created_at: Date; created_at_london: string }>(
      `SELECT id AS room_id,
              created_at,
              to_char(created_at AT TIME ZONE 'Europe/London', 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at_london
       FROM rooms
       ORDER BY created_at DESC
       LIMIT 10`,
    );

    // --- Per-room daily stats for today ---
    const { rows: roomDailyRows } = await app.db.query<{
      room_id: string;
      routes_plotted: string;
      data_updates: string;
      zones_added_roads: string;
      zones_added_nonroads: string;
      tokens_issued: string;
    }>(
      `SELECT room_id, routes_plotted, data_updates, zones_added_roads, zones_added_nonroads, tokens_issued
       FROM analytics_room_daily
       WHERE date = $1`,
      [today],
    );

    // --- Zone counts (excluding home zone) ---
    const { rows: zoneCountRows } = await app.db.query<{ total_zones: string }>(
      `SELECT COUNT(*) AS total_zones
       FROM room_node_positions rnp
       JOIN rooms r ON r.id = rnp.room_id
       WHERE rnp.zone_id != r.home_zone_id`,
    );
    const totalZones = parseInt(zoneCountRows[0]?.total_zones ?? '0', 10);

    const { rows: perRoomZoneRows } = await app.db.query<{ room_id: string; zone_count: string }>(
      `SELECT rnp.room_id, COUNT(*) AS zone_count
       FROM room_node_positions rnp
       JOIN rooms r ON r.id = rnp.room_id
       WHERE rnp.zone_id != r.home_zone_id
       GROUP BY rnp.room_id`,
    );

    const { rows: zoneInRoomsRows } = await app.db.query<{ zone_id: string; room_count: string }>(
      `SELECT rnp.zone_id, COUNT(DISTINCT rnp.room_id) AS room_count
       FROM room_node_positions rnp
       JOIN rooms r ON r.id = rnp.room_id
       WHERE rnp.zone_id != r.home_zone_id
       GROUP BY rnp.zone_id`,
    );

    // --- Chain counts (rooms with only the default primary chain are omitted) ---
    const { rows: perRoomChainRows } = await app.db.query<{ room_id: string; chain_count: string }>(
      `SELECT room_id, COUNT(*) AS chain_count
       FROM room_chains
       GROUP BY room_id
       HAVING COUNT(*) > 1`,
    );

    // --- Generic client events (POST /api/events), bucketed per Europe/London day.
    // All-time totals are SUM(count) across days; new event types appear
    // automatically as new label values — no metrics changes needed. ---
    const { rows: eventAlltimeRows } = await app.db.query<{ event_type: string; total: string }>(
      `SELECT event_type, SUM(count) AS total
       FROM analytics_events
       GROUP BY event_type
       ORDER BY event_type`,
    );
    const { rows: eventTodayRows } = await app.db.query<{ event_type: string; count: string }>(
      `SELECT event_type, count
       FROM analytics_events
       WHERE date = $1
       ORDER BY event_type`,
      [today],
    );

    // --- Server-assignment backfill progress. `rooms.server` is nullable:
    // every room predating the column is unassigned until someone answers the
    // in-room prompt, so this tracks how far that rollout has got. Appended at
    // the end of the query block deliberately — the earlier queries are
    // position-sensitive in the tests. ---
    const { rows: roomServerRows } = await app.db.query<{ server: string | null; count: string }>(
      `SELECT server, COUNT(*) AS count
       FROM rooms
       GROUP BY server
       ORDER BY server NULLS FIRST`,
    );
    const roomsByServer = new Map<string, number>(ROOM_SERVERS.map(s => [s, 0]));
    let roomsServerAssigned = 0;
    let roomsServerUnassigned = 0;
    for (const row of roomServerRows) {
      const count = parseInt(row.count ?? '0', 10);
      if (row.server === null) {
        roomsServerUnassigned += count;
      } else {
        roomsServerAssigned += count;
        // Unknown values (hand-edited rows) still get a series rather than
        // being silently folded into a known server.
        roomsByServer.set(row.server, (roomsByServer.get(row.server) ?? 0) + count);
      }
    }
    const roomsWithServerKnown = roomsServerAssigned + roomsServerUnassigned;
    const roomsServerAssignedPercent = roomsWithServerKnown === 0
      ? 0
      : Math.round((roomsServerAssigned / roomsWithServerKnown) * 10000) / 100;

    // --- Map history split by server. Room memory carries no server of its
    // own, so `rooms.server` is the join key; unlabelled rooms land in the
    // 'unassigned' series rather than being dropped. ---
    const { rows: historyByServerRows } = await app.db.query<{ server: string; total: string; rooms: string }>(
      `SELECT COALESCE(r.server, 'unassigned') AS server,
              COUNT(*) AS total,
              COUNT(DISTINCT rnm.room_id) AS rooms
       FROM room_node_memory rnm
       JOIN rooms r ON r.id = rnm.room_id
       WHERE rnm.zone_id != r.home_zone_id
       GROUP BY 1
       ORDER BY 1`
    );
    const roomsWithHistory = historyByServerRows.reduce((sum, r) => sum + parseInt(r.rooms ?? '0', 10), 0);

    const { rows: mapHistoryByServerRows } = await app.db.query<{ zone_id: string; server: string; total_mentions: string }>(
      `SELECT rnm.zone_id, COALESCE(r.server, 'unassigned') AS server, COUNT(DISTINCT rnm.room_id) AS total_mentions
       FROM room_node_memory rnm
       JOIN rooms r ON r.id = rnm.room_id
       WHERE rnm.zone_id != r.home_zone_id
       GROUP BY rnm.zone_id, 2
       ORDER BY rnm.zone_id, 2`
    );

    // -----------------------------------------------------------------------
    // Output. Metrics are grouped by topic (rooms, connections, zones, chains,
    // routes, tokens, data updates, admin actions, map history) — keep
    // similarly-named metrics physically together when adding new ones.
    // -----------------------------------------------------------------------
    const lines: string[] = [];

    // === Rooms ===
    lines.push(metric('albionmapper_rooms_total', 'Total number of rooms in the database', 'gauge', totalRooms));
    lines.push(metric('albionmapper_rooms_live', 'Number of rooms with at least one active WebSocket connection (live now)', 'gauge', liveRooms));
    lines.push(metric('albionmapper_rooms_active', 'Number of rooms with at least one non-expired connection', 'gauge', activeRooms));
    lines.push(metric('albionmapper_rooms_inactive', 'Number of rooms with no active WebSocket connections', 'gauge', inactiveRooms));
    lines.push(metric('albionmapper_rooms_empty', 'Number of rooms with no connections added', 'gauge', emptyRooms));
    lines.push(metric('albionmapper_rooms_expired', 'Number of rooms where all connections have expired', 'gauge', expiredRooms));
    lines.push(metric('albionmapper_rooms_locked', 'Number of rooms currently locked (read-only for non-admins)', 'gauge', lockedRooms));
    const lockedRoomSeries = lockedRoomRows.map(r => ({ labels: { room_id: r.room_id }, value: 1 }));
    if (lockedRoomSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_room_locked', 'Rooms currently locked (read-only for non-admins), one series per locked room ID', 'gauge', lockedRoomSeries));
    }
    lines.push(metric('albionmapper_rooms_server_assigned', 'Number of rooms with an Albion server assigned', 'gauge', roomsServerAssigned));
    lines.push(metric('albionmapper_rooms_server_unassigned', 'Number of rooms with no Albion server assigned yet (rooms.server IS NULL)', 'gauge', roomsServerUnassigned));
    lines.push(metric('albionmapper_rooms_server_assigned_percent', 'Percentage of rooms with an Albion server assigned (server-assignment backfill progress, 0-100)', 'gauge', roomsServerAssignedPercent));
    const roomsByServerSeries = [
      ...Array.from(roomsByServer.entries()).map(([server, value]) => ({ labels: { server }, value })),
      { labels: { server: 'unassigned' }, value: roomsServerUnassigned },
    ];
    lines.push(metricLabeled('albionmapper_rooms_by_server', 'Number of rooms per Albion server; rooms with no server assigned appear as server="unassigned"', 'gauge', roomsByServerSeries));
    lines.push(metric('albionmapper_daily_rooms_created_total', 'Rooms created today (Europe/London)', 'gauge', parseInt(daily?.rooms_created ?? '0', 10)));
    lines.push(metric('albionmapper_rooms_created_total', 'All-time total rooms created since tracking began', 'counter', totalRoomsCreated));
    lines.push(metric('albionmapper_daily_rooms_modified_total', 'Rooms with at least one data modification today (Europe/London)', 'gauge', parseInt(daily?.rooms_modified ?? '0', 10)));
    lines.push(metric('albionmapper_rooms_modified_total', 'All-time total rooms with at least one data modification since tracking began', 'counter', totalRoomsModified));
    lines.push(metric('albionmapper_daily_rooms_reset_total', 'Rooms reset today (Europe/London)', 'gauge', parseInt(daily?.rooms_reset ?? '0', 10)));
    lines.push(metric('albionmapper_rooms_reset_total', 'All-time total rooms reset since tracking began', 'counter', totalRoomsReset));
    lines.push(metric('albionmapper_daily_rooms_deleted_total', 'Rooms deleted today (Europe/London)', 'gauge', parseInt(daily?.rooms_deleted ?? '0', 10)));
    lines.push(metric('albionmapper_rooms_deleted_total', 'All-time total rooms deleted since tracking began', 'counter', totalRoomsDeleted));
    lines.push(metric('albionmapper_daily_rooms_aborted_total', 'Rooms auto-deleted today for being created but never used (Europe/London)', 'gauge', parseInt(daily?.rooms_aborted ?? '0', 10)));
    lines.push(metric('albionmapper_daily_rooms_abandoned_total', 'Rooms auto-deleted today for being abandoned after modification (Europe/London)', 'gauge', parseInt(daily?.rooms_abandoned ?? '0', 10)));
    lines.push(metric('albionmapper_rooms_aborted_total', 'All-time total rooms auto-deleted for being created but never used', 'gauge', totalRoomsAborted));
    lines.push(metric('albionmapper_rooms_abandoned_total', 'All-time total rooms auto-deleted for being abandoned after modification', 'gauge', totalRoomsAbandoned));
    const latestRoomSeries = latestRoomRows.map(r => ({
      labels: { room_id: r.room_id, created_at: r.created_at_london },
      value: Math.floor(new Date(r.created_at).getTime() / 1000),
    }));
    if (latestRoomSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_latest_rooms_created', 'Latest 10 rooms created, with creation time in Europe/London as a label and value as unix epoch seconds', 'gauge', latestRoomSeries));
    }

    // === Connections (WebSocket) ===
    lines.push(metric('albionmapper_websocket_connections_active', 'Current number of active WebSocket connections', 'gauge', totalConnections));
    const roomSeries = Array.from(roomSockets.entries()).map(([roomId, sockets]) => ({
      labels: { room_id: roomId },
      value: sockets.size,
    }));
    if (roomSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_room_connections', 'Number of active WebSocket connections per room', 'gauge', roomSeries));
    }
    lines.push(metric('albionmapper_hourly_connections_max', 'Maximum concurrent WebSocket connections observed in the most recent recorded hour bucket', 'gauge', lastHourMax));
    lines.push(metric('albionmapper_hourly_connections_min', 'Minimum concurrent WebSocket connections observed in the most recent recorded hour bucket', 'gauge', lastHourMin));
    lines.push(metric('albionmapper_hourly_connections_avg', 'Average concurrent WebSocket connections observed in the most recent recorded hour bucket', 'gauge', lastHourAvg));
    // All hourly buckets as labelled series for hour-of-day activity chart.
    // Label is the Europe/London hour (0–23) so Grafana can avg across multiple days.
    const hourlySeries = allHourlyRows.map(r => ({
      labels: { hour: r.hour_of_day.toString().padStart(2, '0') },
      value: parseFloat(r.avg_connections ?? '0'),
    }));
    if (hourlySeries.length > 0) {
      lines.push(metricLabeled('albionmapper_hourly_connections_avg_by_hour', 'Average concurrent WebSocket connections per Europe/London hour of day', 'gauge', hourlySeries));
    }
    lines.push(metric('albionmapper_daily_peak_concurrent', 'Peak concurrent WebSocket connections today (Europe/London)', 'gauge', parseInt(daily?.peak_concurrent ?? '0', 10)));
    lines.push(metric('albionmapper_alltime_peak_concurrent', 'All-time peak concurrent WebSocket connections since tracking began', 'gauge', alltimePeak));
    lines.push(metric('albionmapper_alltime_avg_concurrent', 'All-time sample-weighted average concurrent WebSocket connections since tracking began', 'gauge', alltimeAvg));

    // === Zones ===
    lines.push(metric('albionmapper_zones_total', 'Total number of zones entered into the system (excluding home zones)', 'gauge', totalZones));
    const perRoomZoneSeries = perRoomZoneRows
      .map(r => ({ labels: { room_id: r.room_id }, value: parseInt(r.zone_count ?? '0', 10) }))
      .filter(s => s.value > 0);
    if (perRoomZoneSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_room_zones_total', 'Total number of zones entered per room (excluding home zone)', 'gauge', perRoomZoneSeries));
    }
    const zoneInRoomsSeries = zoneInRoomsRows
      .map(r => ({ labels: { zone_id: r.zone_id }, value: parseInt(r.room_count ?? '0', 10) }))
      .filter(s => s.value > 0);
    if (zoneInRoomsSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_zone_in_rooms_total', 'Number of distinct rooms each zone currently appears in (excluding home zones)', 'gauge', zoneInRoomsSeries));
    }
    lines.push(metric('albionmapper_daily_zones_added_roads_total', 'Road zones added today (Europe/London)', 'gauge', parseInt(daily?.zones_added ?? '0', 10)));
    lines.push(metric('albionmapper_daily_zones_added_nonroads_total', 'Non-road zones added today (Europe/London)', 'gauge', parseInt(daily?.non_roads_zones_added ?? '0', 10)));
    const zonesRoadsSeries = roomDailyRows.map(r => ({ labels: { room_id: r.room_id }, value: parseInt(r.zones_added_roads ?? '0', 10) })).filter(s => s.value > 0);
    if (zonesRoadsSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_room_zones_added_roads_today', 'Road zones added today (Europe/London) per room', 'gauge', zonesRoadsSeries));
    }
    const zonesNonroadsSeries = roomDailyRows.map(r => ({ labels: { room_id: r.room_id }, value: parseInt(r.zones_added_nonroads ?? '0', 10) })).filter(s => s.value > 0);
    if (zonesNonroadsSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_room_zones_added_nonroads_today', 'Non-road zones added today (Europe/London) per room', 'gauge', zonesNonroadsSeries));
    }

    // === Chains ===
    const perRoomChainSeries = perRoomChainRows
      .map(r => ({ labels: { room_id: r.room_id }, value: parseInt(r.chain_count ?? '0', 10) }))
      .filter(s => s.value > 0);
    const totalChains = perRoomChainSeries.reduce((sum, s) => sum + s.value, 0);
    lines.push(metric('albionmapper_chains_total', 'Total number of chains across rooms that use chains (rooms with only the default primary chain are excluded)', 'gauge', totalChains));
    if (perRoomChainSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_room_chains_total', 'Number of chains per room; rooms with only the default primary chain are omitted', 'gauge', perRoomChainSeries));
    }

    // === Routes ===
    // Live state (from rooms.plotted_route)
    lines.push(metric('albionmapper_rooms_route_plotted', 'Number of rooms with a currently plotted route that is still active (all route legs unexpired)', 'gauge', routePlottedRoomRows.length));
    const routePlottedRoomSeries = routePlottedRoomRows.map(r => ({ labels: { room_id: r.room_id }, value: 1 }));
    if (routePlottedRoomSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_room_route_plotted', 'Rooms with a currently plotted route that is still active (all route legs unexpired), one series per room ID', 'gauge', routePlottedRoomSeries));
    }
    // Cumulative plot counters
    lines.push(metric('albionmapper_routes_plotted_total', 'Total number of routes plotted across all rooms since tracking began', 'counter', totalRoutesPlotted));
    const roomRoutesPlottedAlltimeSeries = alltimeRoomRows
      .map(r => ({ labels: { room_id: r.room_id }, value: parseInt(r.routes_plotted ?? '0', 10) }))
      .filter(s => s.value > 0);
    if (roomRoutesPlottedAlltimeSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_room_routes_plotted_alltime', 'Total number of routes plotted per room since tracking began', 'counter', roomRoutesPlottedAlltimeSeries));
    }
    // Today (Europe/London)
    lines.push(metric('albionmapper_daily_routes_plotted_total', 'Routes plotted today (Europe/London)', 'gauge', parseInt(daily?.routes_plotted ?? '0', 10)));
    const routesTodaySeries = roomDailyRows.map(r => ({ labels: { room_id: r.room_id }, value: parseInt(r.routes_plotted ?? '0', 10) })).filter(s => s.value > 0);
    if (routesTodaySeries.length > 0) {
      lines.push(metricLabeled('albionmapper_room_routes_plotted_today', 'Routes plotted today (Europe/London) per room', 'gauge', routesTodaySeries));
    }
    // Last plotted
    lines.push(metric('albionmapper_routes_last_plotted', 'Unix epoch seconds of the last time any route was plotted (day granularity for plots predating exact tracking; 0 if never)', 'gauge', lastRoutePlottedEpoch));
    const roomLastPlottedSeries = roomLastPlottedRows
      .map(r => ({ labels: { room_id: r.room_id, last_plotted: r.last_plotted }, value: parseInt(r.last_epoch ?? '0', 10) }))
      .filter(s => s.value > 0);
    if (roomLastPlottedSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_room_routes_last_plotted', 'Unix epoch seconds of the last time each room plotted a route, with the Europe/London datetime as a label (day granularity for plots predating exact tracking)', 'gauge', roomLastPlottedSeries));
    }

    // === Tokens ===
    lines.push(metric('albionmapper_tokens_issued_total', 'Total number of authenticated tokens issued since tracking began', 'gauge', totalTokensIssued));
    const roomTokensIssuedSeries = alltimeRoomRows
      .map(r => ({ labels: { room_id: r.room_id }, value: parseInt(r.tokens_issued ?? '0', 10) }))
      .filter(s => s.value > 0);
    if (roomTokensIssuedSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_room_tokens_issued_total', 'Total number of authenticated tokens issued per room', 'gauge', roomTokensIssuedSeries));
    }
    lines.push(metric('albionmapper_daily_tokens_issued_total', 'Tokens issued today (Europe/London)', 'gauge', parseInt(daily?.tokens_issued ?? '0', 10)));
    const tokensIssuedTodaySeries = roomDailyRows.map(r => ({ labels: { room_id: r.room_id }, value: parseInt(r.tokens_issued ?? '0', 10) })).filter(s => s.value > 0);
    if (tokensIssuedTodaySeries.length > 0) {
      lines.push(metricLabeled('albionmapper_room_tokens_issued_today', 'Tokens issued today (Europe/London) per room', 'gauge', tokensIssuedTodaySeries));
    }
    lines.push(metric('albionmapper_daily_unique_tokens_active', 'Unique authenticated tokens seen today (Europe/London)', 'gauge', parseInt(daily?.unique_tokens_active ?? '0', 10)));

    // === Data updates ===
    lines.push(metric('albionmapper_alltime_data_updates_total', 'Total number of room data update events across all rooms since tracking began', 'gauge', totalRoomDataUpdates));
    const roomDataUpdatesAlltimeSeries = alltimeRoomRows
      .map(r => ({ labels: { room_id: r.room_id }, value: parseInt(r.data_updates ?? '0', 10) }))
      .filter(s => s.value > 0);
    if (roomDataUpdatesAlltimeSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_room_data_updates_alltime', 'Total number of room data update events per room since tracking began', 'gauge', roomDataUpdatesAlltimeSeries));
    }
    lines.push(metric('albionmapper_daily_room_data_updates_total', 'Total room data update events today (Europe/London)', 'gauge', parseInt(daily?.room_data_updates ?? '0', 10)));
    const dataUpdatesTodaySeries = roomDailyRows.map(r => ({ labels: { room_id: r.room_id }, value: parseInt(r.data_updates ?? '0', 10) })).filter(s => s.value > 0);
    if (dataUpdatesTodaySeries.length > 0) {
      lines.push(metricLabeled('albionmapper_room_data_updates_today', 'Room data update events today (Europe/London) per room', 'gauge', dataUpdatesTodaySeries));
    }

    // === Admin actions ===
    lines.push(metric('albionmapper_daily_memory_wiped_full_total', 'Full memory wipes performed today (Europe/London)', 'gauge', parseInt(daily?.memory_wiped_full ?? '0', 10)));
    lines.push(metric('albionmapper_daily_memory_wiped_single_total', 'Single memory wipes performed today (Europe/London)', 'gauge', parseInt(daily?.memory_wiped_single ?? '0', 10)));
    lines.push(metric('albionmapper_daily_passwords_rotated_total', 'Password rotations performed today (Europe/London)', 'gauge', parseInt(daily?.passwords_rotated ?? '0', 10)));

    // === Map History ===
    lines.push(metric('albionmapper_history_entries_total', 'Total number of unique room-map history entries (excluding home zones)', 'gauge', totalHistoryEntries));
    const mapHistorySeries = mapHistoryRows
      .map(r => ({ labels: { zone_id: r.zone_id }, value: parseInt(r.total_mentions ?? '0', 10) }))
      .filter(s => s.value > 0);
    if (mapHistorySeries.length > 0) {
      lines.push(metricLabeled('albionmapper_map_history_mentions_total', 'Total number of unique rooms each map has appeared in (excluding home zones)', 'gauge', mapHistorySeries));
    }
    // Per-zone mentions split by server. The DB-wide series above is kept as-is
    // so existing dashboards keep working; this is the regional breakdown.
    const mapHistoryByServerSeries = mapHistoryByServerRows
      .map(r => ({ labels: { zone_id: r.zone_id, server: r.server }, value: parseInt(r.total_mentions ?? '0', 10) }))
      .filter(s => s.value > 0);
    if (mapHistoryByServerSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_map_history_mentions_by_server', 'Number of unique rooms each map has appeared in, split by Albion server (excluding home zones); rooms with no server assigned appear as server="unassigned"', 'gauge', mapHistoryByServerSeries));
    }
    const roomHistorySeries = roomHistoryRows
      .map(r => ({ labels: { room_id: r.room_id }, value: parseInt(r.total_entries ?? '0', 10) }))
      .filter(s => s.value > 0);
    if (roomHistorySeries.length > 0) {
      lines.push(metricLabeled('albionmapper_room_history_size_total', 'Total number of unique maps in each room history (excluding home zone)', 'gauge', roomHistorySeries));
    }
    const historyEntriesByServerSeries = historyByServerRows.map(r => ({
      labels: { server: r.server },
      value: parseInt(r.total ?? '0', 10),
    }));
    if (historyEntriesByServerSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_history_entries_by_server', 'Room-map history entries per Albion server (excluding home zones); rooms with no server assigned appear as server="unassigned"', 'gauge', historyEntriesByServerSeries));
    }
    lines.push(metric('albionmapper_rooms_with_history', 'Number of rooms with at least one map history entry (excluding home zones)', 'gauge', roomsWithHistory));
    const roomsWithHistoryByServerSeries = historyByServerRows.map(r => ({
      labels: { server: r.server },
      value: parseInt(r.rooms ?? '0', 10),
    }));
    if (roomsWithHistoryByServerSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_rooms_with_history_by_server', 'Number of rooms with at least one map history entry, per Albion server; rooms with no server assigned appear as server="unassigned"', 'gauge', roomsWithHistoryByServerSeries));
    }

    // === Events ===
    const eventAlltimeSeries = eventAlltimeRows
      .map(r => ({ labels: { event: r.event_type }, value: parseInt(r.total ?? '0', 10) }))
      .filter(s => s.value > 0);
    if (eventAlltimeSeries.length > 0) {
      lines.push(metricLabeled('albionmapper_events_total', 'Total occurrences of each client analytics event since tracking began', 'counter', eventAlltimeSeries));
    }
    const eventTodaySeries = eventTodayRows
      .map(r => ({ labels: { event: r.event_type }, value: parseInt(r.count ?? '0', 10) }))
      .filter(s => s.value > 0);
    if (eventTodaySeries.length > 0) {
      lines.push(metricLabeled('albionmapper_events_today', 'Occurrences of each client analytics event today (Europe/London)', 'gauge', eventTodaySeries));
    }

    // === Database health ===
    // Alert on these rather than on the container healthcheck: a discarded
    // transaction is worth investigating but must not take the service down.
    const incidents = getDbIncidents();
    lines.push(metric('albionmapper_db_discarded_transactions_total', 'Transactions the database discarded (cancellation, timeout, termination, deadlock) since process start', 'counter', incidents.total));
    lines.push(metricLabeled('albionmapper_db_discarded_transactions_by_reason_total', 'Discarded transactions by reason since process start', 'counter',
      Object.entries(incidents.byReason).map(([reason, value]) => ({ labels: { reason }, value }))));
    lines.push(metric('albionmapper_db_pool_acquisition_timeouts_total', 'Failures to check a connection out of the pool since process start; saturation rather than discarded work, so counted apart from discarded transactions', 'counter', incidents.poolAcquisitionTimeouts));
    const pool = app.db as { totalCount?: number; idleCount?: number; waitingCount?: number };
    lines.push(metric('albionmapper_db_pool_connections', 'Connections currently held by the pg pool', 'gauge', pool.totalCount ?? 0));
    lines.push(metric('albionmapper_db_pool_idle', 'Idle connections in the pg pool', 'gauge', pool.idleCount ?? 0));
    lines.push(metric('albionmapper_db_pool_waiting', 'Queries queued waiting for a free pool connection; sustained non-zero means the pool is exhausted', 'gauge', pool.waitingCount ?? 0));

    return reply
      .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .send(lines.join('\n'));
  });
}
