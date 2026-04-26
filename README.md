# Albion Roads Mapper

A collaborative, real-time web application for *Albion Online* guild members to crowdsource and visualise temporary **Roads of Avalon** portal connections between zones.

Multiple users join a shared, password-protected room and contribute connection data which propagates to all participants over WebSockets in ~250 ms.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Language | TypeScript (strict mode) |
| Backend | Fastify, `@fastify/websocket`, `better-sqlite3`, `bcrypt`, `zod` |
| Frontend | Vite + Vue 3 (`<script setup>`), TailwindCSS, `@vue-flow/core`, `reka-ui`, Pinia |
| Testing | `vitest`, `@testing-library/vue`, `@vue/test-utils`, `supertest` |
| Tooling | pnpm workspaces, `tsx` |

## Quick Start

```bash
# 1. Install all dependencies
pnpm install

# 2. Populate the zone catalogue
pnpm --filter shared sync-maps   # writes web/shared/data/maps.json

# 3. Start both server and client (concurrently)
pnpm dev
```

The client dev server runs on **http://localhost:5173** (proxied to the API server on **:3001**).

---

## Project Structure

```
albion-mapper/
├── web/
│   ├── client/         # Vue 3 SPA — components, stores, composables
│   │   ├── src/
│   │   └── test/
│   ├── server/         # Fastify API — HTTP routes, WS, SQLite, expiry
│   │   ├── src/
│   │   └── test/
│   └── shared/         # Domain types, Zod schemas, zones adapter
│       ├── src/
│       ├── data/       # maps.json (committed, updated by sync-maps)
│       └── test/
├── map-parser/         # Standalone parser that produces maps.json
├── package.json
└── pnpm-workspace.yaml
```

---

## Running Tests

```bash
# All packages at once
pnpm test

# Individual packages
pnpm --filter shared test
pnpm --filter server test
pnpm --filter client test
```

**Test counts (all green):**
- `shared` — 11 tests (zones adapter)
- `server` — 27 tests (rooms, connections, expiry, WebSocket)
- `client` — 31 tests (connectionStyle, roomStore, ZoneCombobox, ReportForm)

---

## Features

### Reporting Flow
Open a room → click or tab into **From zone**, type to search, pick a zone → tab to **To zone** → tab to **time** (enter as `H:MM` or plain minutes) → **Enter** to submit.

### Visualisation (Vue Flow)
- Home zone centred at (0,0); direct neighbours at radius 220 px; second-degree at 440 px.
- Edge colours: **green** (> 30 min), **amber** (10–30 min), **red dashed** (< 10 min), **grey dashed** (stale, within 6 h grace).
- Live countdown on each edge (`MM:SS` or `Hh MMm`).
- Click a node → sets it as the new home zone (broadcasts to all clients).
- Click an edge → opens a popover with reporter, timestamp, and a **Delete** button.

### Real-time Sync
WebSocket at `/ws/rooms/:id`. Authenticated via JWT (sent as first `auth` message). All writes go through REST; WS fans out `connection_added`, `connection_removed`, and `room_updated` events to every authenticated subscriber in the same room.

### Security
- Passwords hashed with `bcrypt` (cost 12).
- Short-lived JWT (24 h) for API and WS auth.
- Rate limiting: `POST /api/rooms` → 10/hour/IP; `POST /api/rooms/:id/auth` → 20/hour/IP.
- Zone validation on every connection submission (both IDs must exist in catalogue, must differ).

---

## Environment Variables (server)

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | `change-me-in-production` | HMAC secret for JWT signing |
| `PORT` | `3001` | Server listen port |
| `HOST` | `0.0.0.0` | Server listen host |
