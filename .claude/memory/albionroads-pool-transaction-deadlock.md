---
name: albionroads-pool-transaction-deadlock
description: A pool query inside an open transaction self-deadlocks against the room lock and takes the whole API down — the 2026-08-06 outage
metadata: 
  node_type: memory
  type: project
  originSessionId: 7c974b26-c811-4f0e-9a7f-63a6c1a7c854
  modified: 2026-08-06T13:40:10.443Z
---

**Never call `app.db.query` / `ctx.app.db.query` between a `BEGIN` and its `COMMIT` — use the checked-out client.** On 2026-08-06 `operations/rotate_zone.ts` mirrored a rotation into `room_node_memory` via the pool while its own transaction held the room row `FOR UPDATE`. The insert's FK check (`room_node_memory.room_id → rooms.id`) needs `FOR KEY SHARE` on that locked row, so connection B waited for connection A to commit, and A was waiting for B to return.

**Why it is so destructive:** Postgres cannot see it as a deadlock. The holder sits `idle in transaction / ClientRead` — waiting on the *app*, not on a lock — so no deadlock detector fires and nothing times out by default. Every later rotate/position-save for that room then queues on the room lock, one connection each, until node-pg's default `max` of 10 is gone. With the pool exhausted every pooled query waits forever, including `/api/health`, so the API looks completely dead while Postgres is healthy and idle. Production ran that way for seven hours.

**How to apply:**
- Diagnose it with `pg_stat_activity`: `idle in transaction` + `ClientRead` at the head of a `pg_blocking_pids` chain means the app abandoned a transaction; the age of the oldest one dates the onset exactly.
- The trigger was rare because `ON CONFLICT DO UPDATE` only re-checks the FK on a genuine insert — so it fired on the *first* `room_node_memory` row for a (room, zone) pair, not on every rotation. Rare-but-fatal, and it survived four days before firing.
- `db.ts` now sets `statement_timeout` and `idle_in_transaction_session_timeout` (30s) so this can only ever be a blip, and `db_incidents.ts` counts discarded transactions into `/metrics` and `/api/health`.
- **Instrumenting the pool is its own trap, and the mocked-pool suite cannot catch it.** pg-pool implements `pool.query()` as `this.connect(callback)`, so a promise-only `connect` override breaks every pooled query with an unhandled rejection — fatal on Node's default. And a checked-out client has no `error` listener (pg-pool removes its idle one on acquire), so a backend killed mid-transaction crashes the process unless one is attached. Both were caught by a Codex review of the fix, not by tests or CI; `test/db_incidents.test.ts` pins them against a fake pool now.
- **`/api/health` must never fail on these counters.** Docker's healthcheck keys off the HTTP status, so gating it on pool or discard counts would take the container down over a blip. Alert on `/metrics`.
- Nothing was watching the container healthcheck — it sat unhealthy for seven hours with `restarts=0`. Being unhealthy alerts no one; that gap is separate from the bug.

Related: [[albionroads-gotchas]] (room-lock chokepoint), [[albionroads-metrics-conventions]].
