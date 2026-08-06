# Server (`web/server`)

Fastify 5 (ESM, TypeScript) with a `pg` Pool, `@fastify/jwt`, `@fastify/websocket`, rate limiting, and CORS. Zod schemas come from `web/shared/src/types.ts`.

## Startup & configuration

- **Entry:** `web/server/src/index.ts` — loads dotenv, runs `initDb()` (node-pg-migrate `up`, migrations table `pgmigrations`), builds the app via `buildApp({ db })`, starts three background intervals, listens on `PORT`/`HOST`.
- **App factory:** `web/server/src/app.ts` — `buildApp({ db, jwtSecret?, logger?, disableRateLimit? })`. Registers CORS, the `db` decorator, JWT, the `authenticate` preHandler, rate limiting, websocket, then route plugins: rooms, connections, ws, health, media, metrics.
- **Env vars** (`web/server/.env.example`): `DATABASE_URL` (required), `JWT_SECRET` (default `change-me-in-production`), `PORT` (3001), `HOST` (0.0.0.0).
- **Scripts:** `dev` (tsx watch), `build` (tsc), `start` (node dist), `test` (vitest run), `seed` (`fixtures/seed.ts`), `migrate`.

## Auth model

- `POST /api/rooms/:id/auth` verifies the room password (bcrypt, cost 12) and signs a JWT `{ roomId, passwordVersion }` with **7-day** expiry.
- `POST /api/rooms/:id/auth/admin` verifies the room's **admin password** (against `admin_password_hash` only — the room password can never mint an admin token) and signs `{ roomId, passwordVersion, role: 'admin' }` (7-day). The `role` claim is set exclusively on this signing path (`RoomTokenPayload` in shared). The client swaps its stored token for the admin one (one token per room).
- The `authenticate` preHandler (`app.ts`) verifies the JWT, then runs the **room guard** (`src/utils/roomGuard.ts`, single `ROOM_GUARD_SQL` query): it checks `passwordVersion` against `rooms.password_version` (password rotation bumps the version and invalidates all outstanding tokens) and enforces the **room lock** — when `rooms.locked` is true, every non-GET request from a token without `role: 'admin'` gets 403 `Room is locked`. This is a chokepoint: new mutating routes are covered automatically.
- Every mutating room/connection route also requires `jwtPayload.roomId === :id` (else 403). A token grants access to exactly one room; admin tokens are equally room-scoped.
- Destructive/administrative actions additionally require the room's **admin password** in the request body: password change, title change, memory wipe, room delete (optional on connections-reset).
- `PATCH /api/rooms/:id/lock` `{ locked }` toggles the lock; it requires an admin-role token even while unlocked, and broadcasts `room_lock_changed`.

## HTTP routes

Validation failures return 400 with a formatted Zod error. All schemas live in `web/shared/src/types.ts`.

### Rooms — `web/server/src/routes/rooms.ts`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/rooms/resolve/:slug` | none | `{ id }` or 404 |
| GET | `/api/slugs/check/:slug` | none | `{ available }`; slug must match `/^[a-z0-9-]+$/`, ≤100 chars |
| POST | `/api/rooms` | none (rate-limited) | `{ password, adminPassword, homeZoneId, title?, server?, vanityUrl }` → 201 `{ id, shareUrl }`. `server` (`eu`/`us`/`asia`) is optional on the wire but required by the create form — a room without one is prompted in-app. Room id **is** the vanity slug. Creates room + primary chain + home-zone position + memory in a transaction. 409 if slug taken |
| POST | `/api/rooms/:id/auth` | none (rate-limited) | `{ password }` → `{ token }`; 401 bad password |
| POST | `/api/rooms/:id/auth/admin` | none (rate-limited) | `{ adminPassword }` → `{ token }` with `role: 'admin'`; 401 bad admin password. Compares only `admin_password_hash`, scoped to `:id` |
| PATCH | `/api/rooms/:id/lock` | JWT (admin role) | `{ locked: boolean }` → `{ ok, locked }`; 403 without admin role. Broadcasts `room_lock_changed` |
| PATCH | `/api/rooms/:id/password` | JWT + admin pw | Bumps `password_version`; broadcasts `password_rotated` |
| PATCH | `/api/rooms/:id/title` | JWT + admin pw | Title ≤50 chars; broadcasts `room_title_updated` |
| PATCH | `/api/rooms/:id/server` | JWT (+ admin pw to *change*) | `{ server: 'eu'\|'us'\|'asia', adminPassword? }` → `{ ok, server }`. **Asymmetric auth:** the first assignment (`rooms.server IS NULL`) and re-sending the current value need only a room token, so the in-room prompt can backfill legacy rooms; changing a recorded value requires the admin password (400 without it, 401 if wrong). Broadcasts `room_server_updated` |
| POST | `/api/rooms/:id/chains` | JWT | `{ sourceZoneId, x?, y? }` → 201 `{ chain }`. 409 if zone already in a chain. Broadcasts `chain_added` (+ single-row `node_positions_updated`) |
| PATCH | `/api/rooms/:id/chains/:chainId` | JWT | `{ chainColor }` (hex `#RRGGBB`); broadcasts `chain_updated` |
| POST | `/api/rooms/:id/chains/:chainId/relocate` | JWT | `{ sourceZoneId }` — wipes the chain's connections/positions/memory, re-roots at the old coords; updates `home_zone_id` if primary chain. Broadcasts `chain_relocated` |
| DELETE | `/api/rooms/:id/chains/:chainId` | JWT | 400 if primary chain. **One statement** removes the chain's connections, positions, the chain row and bumps `updated_at`; like `relocate` it sweeps by zone membership as well as `chain_id`, so rows whose `chain_id` was never set don't survive as ghosts. Never removes the home zone or another chain's source/zones. Map history is preserved. Broadcasts `chain_removed` with the ids actually removed |
| DELETE | `/api/rooms/:id/connections` | JWT (admin pw optional) | Room reset: deletes all connections + non-source positions, wipes features on chain sources. Broadcasts `room_reset` |
| DELETE | `/api/rooms/:id/memory` | JWT + admin pw | Wipes all room memory; broadcasts empty `memory_sync` |
| DELETE | `/api/rooms/:id/memory/:zoneId` | JWT | Broadcasts `memory_deleted` |
| DELETE | `/api/rooms/:id` | JWT + admin pw | Deletes the room and all dependents; broadcasts `room_deleted` |
| PUT | `/api/rooms/:id/import` | JWT | `ImportRoomBodySchema` — full state replace; chain membership re-derived by BFS from each chain source. Broadcasts `room_reset` |

### Connections — `web/server/src/routes/connections.ts`

| Method | Path | Notes |
|---|---|---|
| GET | `/api/rooms/:id/connections` | Connections that are permanent or within the 6 h expiry grace window |
| POST | `/api/rooms/:id/connections` | `CreateConnectionBodySchema`. Upserts target node position, records roads memory (3 h dedup), inserts connection. Broadcasts full-array `node_positions_updated` + `connection_added` (+ `memory_updated`). Expiry = `secondsRemaining` or +100 yr if `permanent` |
| PATCH | `/api/rooms/:id/connections/:connId` | `{ secondsRemaining?, fromHandleId?, toHandleId? }`. Broadcasts `node_positions_updated` + `connection_updated` |
| DELETE | `/api/rooms/:id/connections/:connId` | Also removes orphaned endpoint zones (no remaining connections, not chain source/home). One `connection_removed` broadcast with `connectionId` + `removedZoneIds` |
| POST | `/api/rooms/:id/connections/bulk-delete` | `BulkDeleteConnectionsBodySchema` (`{ connectionIds }`, 1–500, de-duplicated). Branch delete: deletes every listed connection **and** any zones it orphans in a **single CTE statement**, then one `connection_removed` broadcast with `connectionIds` + `removedZoneIds`. Returns `{ removedConnectionIds, removedZoneIds }`; no broadcast when nothing matched |
| DELETE | `/api/rooms/:id/nodes/:zoneId` | Deletes an orphan node (400 if home zone or chain source). `connection_removed` with empty `connectionId` |

The bulk statement's orphan check runs against the pre-`DELETE` snapshot (all CTEs share one snapshot), so the doomed connections are excluded explicitly via `c.id <> ALL($2)` — dropping that predicate would silently stop detecting orphans. Map history (`room_node_memory`) is preserved, as with every other implicit edit.

`Connection` wire shape: `{ id, roomId, fromZoneId, toZoneId, fromHandleId?, toHandleId?, expiresAt, reportedAt, reportedBy?, chainId?, permanent? }`.

### Other routes

- `GET /api/health` — `{ status: 'ok', roomCount, pool, discardedTransactions }` (`routes/health.ts`). `pool` is the live `pg.Pool` census (`total`/`idle`/`waiting`); `discardedTransactions` counts transactions Postgres threw away (see [database.md](database.md#pool-timeouts-and-discarded-transactions)). **`status` is deliberately never derived from either** — Docker's healthcheck keys off the HTTP status, so letting a discarded transaction or a busy pool fail this endpoint would take the container down over a blip. Alert on `/metrics` instead.
- `GET /api/version` — `{ version }` (`routes/health.ts`). Unauthenticated, `Cache-Control: no-store`. Returns the `app_settings.client_version` token (falls back to `'1'` if the row is missing). It's an **opaque reload-generation token**, not a git SHA — the client (`useVersionWatch`) snapshots it on load and polls every 3 min (+ on tab focus); when it changes, every open tab shows a persistent "please reload" prompt (it does **not** auto-reload — see [client.md](client.md)). Start a wave by bumping the DB value by hand — `UPDATE app_settings SET value = value::int + 1 WHERE key = 'client_version'` — no redeploy of client or server needed. This reaches users **not** in a room (they hold no WS), unlike the WS `force_reload` message.
- `POST /api/events` — generic client analytics ingestion (`routes/events.ts`). Body `{ type }` where `type` is an open slug (`/^[a-z0-9_]+$/`, ≤64 chars, `EventBodySchema` in shared) — **not** an enum, so new client events need no server changes. Upserts `analytics_events (event_type, date, count)` per Europe/London day (`incrementEvent` in `analytics.ts`, fire-and-forget). Deliberately **unauthenticated** (a JWT'd version would be 403'd by the room-lock guard in locked rooms); slug validation + rate limiting are the abuse guards. Current events: `donation_modal_shown`, `donation_modal_clicked`, `donation_planner_clicked`.
- `GET /metrics` — Prometheus text format, **IP-allowlisted** (localhost + `10.0.1.0/24` only), no JWT (`routes/metrics.ts`). ~40 `albionmapper_*` metric families; timezone math is Europe/London. Generic client events surface automatically as labeled series in the Events section: `albionmapper_events_total{event=…}` (counter, SUM over day buckets) and `albionmapper_events_today{event=…}` (gauge).

#### Server-breakdown metrics

Rooms carry an Albion server (`rooms.server`, nullable). These series track the backfill and split map history by region; every DB-wide series they sit next to is unchanged, and rooms with no server assigned appear under `server="unassigned"` rather than being dropped.

| Metric | Type | Labels | Section | What it is |
|---|---|---|---|---|
| `albionmapper_rooms_server_assigned` | gauge | — | Rooms | Rooms with a server recorded |
| `albionmapper_rooms_server_unassigned` | gauge | — | Rooms | Rooms still `NULL` |
| `albionmapper_rooms_server_assigned_percent` | gauge | — | Rooms | Backfill progress, 0–100 (0 when the DB has no rooms — never `NaN`) |
| `albionmapper_rooms_by_server` | gauge | `server` | Rooms | Rooms per server; always emits all three servers (zeros included) plus `unassigned`, so the label set is stable |
| `albionmapper_history_entries_by_server` | gauge | `server` | Map History | Room-map history entries per server (excl. home zones) — the DB-wide total stays `albionmapper_history_entries_total` |
| `albionmapper_rooms_with_history` | gauge | — | Map History | Rooms holding at least one history entry |
| `albionmapper_rooms_with_history_by_server` | gauge | `server` | Map History | …split by server |
| `albionmapper_map_history_mentions_by_server` | gauge | `zone_id`, `server` | Map History | Rooms each zone appears in, per server — the regional split of `albionmapper_map_history_mentions_total` (which is kept as-is) |

On the Grafana dashboard these live in the rows matching their `/metrics` section: rooms-by-server, the rollout percentage and rooms-per-server-over-time in **Room State**; entries-by-server, rooms-with-history-by-server and `topk(20, sort_desc(albionmapper_map_history_mentions_by_server > 1))` in **Map History**, alongside (not replacing) the database-wide totals.

### Rate limits

`POST /api/rooms` → 10/hour/IP; `POST /api/rooms/:id/auth` → 20/hour/IP; `POST /api/events` → 120/hour/IP. Disabled in tests via `disableRateLimit`.

## Business-rule validation

Beyond Zod shape checks, enforced in route/operation code:

- Zone ids must exist in `ZONE_BY_ID` (the shared catalogue).
- No same-zone connections (`from === to`).
- **Chain membership:** the source zone must already be on the map with a `chain_id`; the target must not belong to a *different* chain (no cross-chain bridges).
- **No duplicate edges** (WS create): rejects a connection duplicating an existing edge in either direction.
- **Handle occupancy:** an existing non-expired connection on the same source handle (with `center` normalized) → 400.
- **Disabled handles** (HTTP create): `custom_handles` entries with `disabled: true` on either endpoint → 400.
- **Rotation/handle self-heal:** `operations/update_node_positions.ts` and `operations/rotate_zone.ts` re-infer rotation from handles (`shared/src/rotation.ts`) and canonicalize when stored rotation disagrees — handles win.
- **Memory dedup:** roads-zone sighting timestamps appended only if >3 h since the last one.
- `CreateConnectionBodySchema` `superRefine`: `secondsRemaining` (1–86400) and `slots` (7 or 20) required unless `permanent`.

## Background jobs

Started in `index.ts`, cleared on shutdown:

| Job | File | Interval | What it does |
|---|---|---|---|
| Expiry cleanup | `src/expiry.ts` | 60 s | Broadcasts `connection_expired` for freshly expired connections; hard-deletes connections older than the 6 h grace (`EXPIRE_GRACE_MS`), broadcasting `connection_removed` |
| Analytics cron | `src/analyticsCron.ts` | 60 s | Flushes in-memory concurrency/unique-token stats to the analytics tables; hourly connection buckets; daily rollover at Europe/London midnight |
| Room cleanup | `src/roomCleanup.ts` | 1 h (runs immediately) | Deletes **aborted** rooms (empty, >5 days old) and **abandoned** rooms (stale >30 days), tracking counts in analytics |

In-memory analytics state lives in `src/broadcast_analytics.ts` (per-room peak concurrency + JWT-signature-fingerprint unique tokens), flushed each minute by the cron.
