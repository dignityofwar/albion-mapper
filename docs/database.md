# Database Schema

PostgreSQL, managed by `node-pg-migrate`. Migrations live in `web/server/migrations/` (JS files); tracking table `pgmigrations`. `initDb()` in `web/server/src/db.ts` runs them on server boot. Connection via a single `pg.Pool` from `DATABASE_URL`.

## Core tables

### `rooms`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | **Is** the vanity slug (`/^[a-z0-9-]+$/`) |
| `password_hash` | text NOT NULL | bcrypt cost 12 |
| `admin_password_hash` | text NOT NULL | Gates destructive/administrative actions |
| `home_zone_id` | text NOT NULL | Primary chain's source zone |
| `title` | text | ≤50 chars |
| `server` | text | Albion game server the room maps: `eu` \| `us` \| `asia`. **Nullable** — rooms predating the column are unassigned until the in-room prompt labels them, so analytics queries must handle NULL |
| `password_version` | int NOT NULL default 1 | Bumped on rotation; embedded in JWTs to invalidate them |
| `plotted_route` | text[] | Currently plotted route (**connection** ids — the edges the client's BFS traversed, not zone ids) |
| `plotted_route_from_zone_id` / `plotted_route_to_zone_id` / `plotted_route_chain_id` | text | Route endpoints |
| `plotted_route_expires_at` | timestamptz | Snapshotted at plot time: MIN(`expires_at`) of the route's connections (route "active" check for `/metrics`); NULL when no route |
| `chain_migrated` | boolean NOT NULL default false | Lazy migration flag (backfilled on WS auth) |
| `created_at` | timestamptz NOT NULL default now | |
| `updated_at` | timestamptz | Drives abandoned-room cleanup |

### `connections`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `room_id` | text NOT NULL FK→rooms ON DELETE CASCADE | Index `idx_conn_room` |
| `from_zone_id` / `to_zone_id` | text NOT NULL | Must exist in the zone catalogue |
| `from_handle_id` / `to_handle_id` | text | Which portal handle on each zone |
| `expires_at` | timestamptz NOT NULL | +100 yr for `permanent` connections |
| `reported_at` | timestamptz NOT NULL default now | |
| `reported_by` | text | Free-text reporter name |
| `chain_id` | text FK→room_chains ON DELETE CASCADE | |
| `permanent` | boolean default false | Static world links (non-roads↔non-roads) |

### `room_node_positions` — where each zone sits on a room's canvas

| Column | Type | Notes |
|---|---|---|
| (`room_id`, `zone_id`) | PK | `room_id` FK→rooms CASCADE; index `idx_node_positions_room` |
| `x` / `y` | real | Vue Flow canvas coordinates |
| `features` | jsonb default `{}` | `NodeFeatures` — cores, reds, chests, resources, timers… |
| `custom_handles` | jsonb | User-edited handle layout (incl. disabled handles) |
| `explored` | boolean default false | |
| `rotation` | int default 0 | 0–3 clockwise 90° steps |
| `chain_id` | text FK→room_chains CASCADE | |

### `room_node_memory` — per-room history of roads zones

| Column | Type | Notes |
|---|---|---|
| (`room_id`, `zone_id`) | PK | index `idx_room_node_memory_room` |
| `times_added` | timestamptz[] NOT NULL default `{}` | Sighting timestamps, deduped to >3 h apart |
| `features` / `custom_handles` / `rotation` | jsonb / jsonb / int | Last-known layout, restored when the zone reappears |
| `last_updated` | timestamptz NOT NULL default now | |

### `room_chains`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `room_id` | text NOT NULL FK→rooms CASCADE | index `idx_room_chains_room` |
| `source_zone_id` | text NOT NULL | Chain root |
| `chain_number` | int | 1 = primary (home zone); MAX+1 on insert |
| `chain_color` | text | Hex; defaults via `defaultChainColor()` from the shared palette |
| `created_at` | timestamptz NOT NULL default now | |

## Global settings

### `app_settings` — site-wide key/value store (no room scope)

| Column | Type | Notes |
|---|---|---|
| `key` | text PK | |
| `value` | text NOT NULL | |
| `updated_at` | timestamptz NOT NULL default now | |

Seeded with one row: `('client_version', '1')` — the reload-generation token served by `GET /api/version` and watched by the client (`useVersionWatch`). Bump `value` by hand to force all open tabs to reload (see [server.md](server.md) `GET /api/version`). Generic table — future global flags can be added as new keys without a migration.

### Correlating map history with servers

`rooms.server` is the join key for per-region analysis — room memory and node features carry no server of their own:

```sql
SELECT r.server, m.zone_id, count(*) AS sightings
FROM room_node_memory m JOIN rooms r ON r.id = m.room_id
WHERE r.server IS NOT NULL
GROUP BY r.server, m.zone_id;
```

Because it lives on `rooms`, this data disappears when a room is deleted or cleaned up (unlike the `analytics_*` tables, which have no FK to `rooms`) — snapshot it if long-horizon comparisons matter.

## Analytics tables

Written by `src/analytics.ts` / `src/analyticsCron.ts`; read by `/metrics`. No FKs to `rooms` (they survive room deletion). All daily bucketing uses Europe/London.

- **`analytics_global_daily`** — `date` PK; counters: `rooms_created/modified/reset/deleted/aborted/abandoned`, `memory_wiped_full/single`, `passwords_rotated`, `active/inactive/total_rooms`, `peak_concurrent`, `unique_tokens_active`, `zones_added`, `non_roads_zones_added`, `room_data_updates`, `routes_plotted`, `tokens_issued`.
- **`analytics_hourly_connections`** — `hour` PK; `max/min_connections`, `avg_connections` numeric, `sample_count`.
- **`analytics_room_daily`** — (`room_id`, `date`) PK; `data_updates`, `zones_added_roads/nonroads`, `peak_concurrent`, `unique_tokens`, `routes_plotted`, `tokens_issued`.
- **`analytics_room_alltime`** — `room_id` PK; same counters, all-time; plus `routes_last_plotted_at` timestamptz (exact time of last route plot; NULL for pre-column history — `/metrics` falls back to the daily buckets).
- **`analytics_global_alltime`** — singleton row (`id` = 1); `rooms_aborted`, `rooms_abandoned`, `routes_last_plotted_at` timestamptz.
- **`analytics_events`** — (`event_type`, `date`) PK; `count`. Generic per-day counters for client events (`POST /api/events`); event types are open slugs, all-time totals are `SUM(count)` — new events need no schema change.

## Operational notes

- **Local DB:** `pnpm db:up` starts Postgres 16 in Docker (see [development.md](development.md)); data persists in `provisioning/volumes/db-data/` (a bind-mounted datadir — never commit or hand-edit).
- **Tests never touch Postgres** — the entire pool is mocked (see [testing.md](testing.md)).
- **Adding a migration:** drop a new timestamped JS file in `web/server/migrations/`; it runs automatically on next server boot, or explicitly via `pnpm --filter server migrate`.
- Positions are commonly updated via **delete+reinsert** (preserving `chain_id`) rather than UPDATE — be careful when adding columns to `room_node_positions` that the reinsert paths (`operations/update_node_positions.ts`, import, relocate) carry them through.

## Pool timeouts and discarded transactions

**Never issue a pool query (`app.db.query`) inside an open transaction — use the checked-out client.** Handlers that lock a room take `SELECT … FROM rooms WHERE id = $1 FOR UPDATE`. Any write to a table with an FK to `rooms` needs a `FOR KEY SHARE` lock on that same row, so a pool query inside the transaction takes a *second* connection that blocks until the transaction commits — while the transaction is itself waiting for that query to return. Postgres cannot detect it as a deadlock (the holder is `idle in transaction`, waiting on the client, not on a lock), so it hangs forever. Everything else then queues on the room lock until the pool is exhausted and every pooled query — `/api/health` included — waits indefinitely. This took production down for seven hours on 2026-08-06 via `operations/rotate_zone.ts`.

The backstops in `db.ts`: `max: 10`, `connectionTimeoutMillis`, `idleTimeoutMillis`, `statement_timeout` and `idle_in_transaction_session_timeout` (30s). A stranded transaction is now killed rather than held forever.

Anything Postgres discards that way is counted by `instrumentPool()` in `db_incidents.ts`, wired in at the pool *and* at every checked-out client, so no call site can swallow one. Surfaced as `albionmapper_db_discarded_transactions_total`, `…_by_reason_total{reason}` and the `albionmapper_db_pool_*` gauges, and echoed in `/api/health` for eyeballing. Ordinary rollbacks are *not* counted — several handlers roll back deliberately — so any non-zero value is worth investigating. `albionmapper_db_pool_waiting` staying above zero is the direct signal of the failure above. Pool-acquisition timeouts are counted separately (`albionmapper_db_pool_acquisition_timeouts_total`): no statement reached the server, so they mean saturation rather than abandoned work.

Two traps when touching that instrumentation:

- **`pool.connect` must keep its callback overload.** pg-pool implements `pool.query()` as `this.connect(callback)`, and callback-form `connect` returns `undefined`. A promise-only override therefore calls `.catch` on `undefined` inside an async function nobody awaits — an unhandled rejection on *every* pooled query, fatal on Node's default. `test/db_incidents.test.ts` pins this against a fake pool; the mocked-pool suite cannot reach it.
- **Checked-out clients need their own `error` listener.** pg-pool removes its idle listener on acquire and restores it on release, so a backend killed mid-transaction — exactly what `idle_in_transaction_session_timeout` does — emits an unhandled `error` and takes the process down.

Rollbacks in `catch` blocks go through `safeRollback()` (`db_tx.ts`): on a terminated connection the `ROLLBACK` throws too, and awaiting it bare replaces the real error with a useless one.
