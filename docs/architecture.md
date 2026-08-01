# Architecture Overview

## Packages

pnpm workspace (`pnpm-workspace.yaml`): `web/client`, `web/server`, `web/shared`, `map-parser`.

```
┌─────────────────────┐         ┌──────────────────────────┐
│  web/client         │  REST   │  web/server              │
│  Vue 3 + Vue Flow   │◄───────►│  Fastify + pg + JWT      │
│  Pinia stores       │   WS    │  broadcast registry      │
└─────────┬───────────┘◄───────►└───────┬─────────┬────────┘
          │                             │         │
          │ imports                     │ imports │ SQL
          ▼                             ▼         ▼
┌─────────────────────┐         ┌───────────┐  ┌───────────┐
│  web/shared         │◄────────│ map-parser│  │ PostgreSQL│
│  types, Zod schemas │ writes  │ sync-maps │  └───────────┘
│  zones adapter      │ maps.json           │
│  handles/rotation   │         └───────────┘
└─────────────────────┘
```

- **`web/shared`** is the contract between everything: domain types (`Zone`, `Connection`, `NodePosition`, `RoomChain`, `NodeFeatures`…), Zod request schemas, the `ServerMessage`/`ClientMessage` WS unions, the zone catalogue (`ZONES` / `ZONE_BY_ID`), handle geometry, and rotation math. Client and server both import it (`shared` workspace package; client aliases it to source, server consumes built `dist/`).
- **`web/server`** owns all state. Every mutation — REST route or WS operation — validates, writes to Postgres, then broadcasts to the room's authenticated sockets. See [server.md](server.md).
- **`web/client`** is a thin-ish reactive view over server state: Pinia stores apply broadcast messages to reactive refs; watchers rebuild Vue Flow nodes/edges. Optimistic updates are applied locally then overwritten by the authoritative broadcast. See [client.md](client.md).
- **`map-parser`** is offline tooling that regenerates the committed zone catalogue from an upstream JSON dump. See [data-pipeline.md](data-pipeline.md).

## Core data flow: reporting a connection

1. User picks from-zone / to-zone / time in the client (`ReportForm.vue` or dragging between handles on the canvas).
2. Client validates locally (same-zone, cross-chain, occupied/disabled handles, loop warnings) — see [client.md §validation](client.md#auth-room-join--client-side-validation).
3. Client sends `create_connection` over WS (or `POST /api/rooms/:id/connections`).
4. Server re-validates everything (zone existence, chain membership, cycle/occupancy checks — client validation is UX, server validation is authoritative), upserts the target `room_node_positions` row, records roads memory, inserts the `connections` row.
5. Server broadcasts `node_positions_updated` (the **full positions array** for the room, re-read from DB) followed by `connection_added` to every authenticated socket in the room.
6. Each client's `useRoomStore.applyMessage()` mutates store state → deep watchers rebuild the Vue Flow graph → UI updates for everyone in ~250 ms.

## Key design decisions

- **Server-authoritative positions.** Node `{x, y}` come only from the server; the client no longer persists inferred positions itself (a past DELETE+reinsert footgun — see comments in `web/client/src/views/RoomView.vue`). Most position broadcasts carry the *entire* room positions array; exceptions (single-row) are `chain_added`'s new source node and `rotate_zone`.
- **Granular WS events, not state diffing.** The server emits typed events (`connection_added`, `chain_relocated`, `memory_updated`…) and the client reduces them. The full-state `sync` message is sent only on WS (re)connect.
- **Per-room JWT.** Token payload `{ roomId, passwordVersion }`, 7-day expiry. Password rotation bumps `rooms.password_version`, instantly invalidating all outstanding tokens (checked on every authenticated request and re-verified per WS operation).
- **Chains as isolation boundaries.** Connections carry a `chain_id`; the server rejects cross-chain links. Deleting/relocating a chain cascades to its connections, positions, and memory.
- **Self-healing rotation.** Zone rotation (0–3 × 90° steps) and custom handle layouts can desync; both server (`update_node_positions`, `rotate_zone`) and client (`validateNodeRotations`) re-infer rotation from handles and repair — handles win over stored rotation.
- **Expiry with grace.** Connections expire live (`connection_expired` broadcast within ~60 s) but rows are kept for a 6-hour grace window (rendered grey/stale) before a background job deletes them.
- **Committed data file.** The 815-zone catalogue is a build-time artifact committed to git, so there is no runtime dependency on the upstream source; the Docker image copies `web/shared/data` in.

## Entry points

| Concern | File |
|---|---|
| Server boot (migrations, background jobs, listen) | `web/server/src/index.ts` |
| Fastify app factory (used by tests too) | `web/server/src/app.ts` |
| WS route + auth handshake | `web/server/src/ws.ts` |
| Broadcast registry | `web/server/src/broadcast.ts` |
| Client boot | `web/client/src/main.ts` |
| Client router (4 routes) | `web/client/src/router/index.ts` |
| The map view (canvas + connection logic) | `web/client/src/views/RoomView.vue` |
| Core client store + WS client | `web/client/src/stores/useRoomStore.ts` |
| Shared barrel | `web/shared/src/index.ts` |
| WS message unions + Zod schemas | `web/shared/src/types.ts` |
| Zone catalogue adapter | `web/shared/src/zones.ts` |
| Catalogue generator | `map-parser/scripts/syncMaps.ts` |
