# Development & Operations

## Local setup

```bash
# 1. Env files (see below)
# 2. Start Postgres 16 in Docker and wait for readiness
pnpm db:up
# 3. Install deps
pnpm install
# 4. Build once so shared/dist exists (server imports shared's built output)
pnpm build
# 5. Run client (5173) + server (3001) together
pnpm dev
```

Client dev server: http://localhost:5173, proxying `/api` and `/ws` to the API on :3001.

**Gotcha:** `pnpm dev` does **not** watch `web/shared` — it's prebuilt. After editing shared code, re-run `pnpm --filter shared build` for the *server* to pick it up (the client aliases `shared` to source, so Vite sees shared edits live; the server consumes `dist/`).

## Env files

- `web/server/.env`: `DATABASE_URL` (required), `JWT_SECRET`, `PORT` (3001), `HOST` (0.0.0.0).
- `provisioning/.env`: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (compose defaults: `user`/`password`/`dbname`). Keep `POSTGRES_DB` and the database name inside `DATABASE_URL` in sync.
- Client: `VITE_API_URL` overrides the API base in non-dev builds (`web/client/src/utils/api.ts`); Vercel `preview` deployments hardcode `https://api-testing.albionroads.live`.

## Root scripts (`package.json`)

| Script | Does |
|---|---|
| `pnpm dev` | client + server dev servers in parallel |
| `pnpm db:up` / `db:down` | `scripts/start-local-db.sh` (compose up `db` + `pg_isready` poll) / compose down |
| `pnpm build` | ordered: shared → server → client |
| `pnpm test` / `pnpm lint` | recursive across all packages |
| `pnpm format` | prettier over `web/**` |
| `pnpm changelog` | interactive git-cliff, prepends to `CHANGELOG.md` |
| `pnpm --filter map-parser sync-maps` | regenerate `web/shared/data/maps.json` from upstream ([data-pipeline.md](data-pipeline.md)) |
| `pnpm --filter server seed` | seed fixtures (`web/server/fixtures/seed.ts`) |
| `pnpm --filter server migrate` | run migrations explicitly (they also run on server boot) |

Other tooling: `web/server/scripts/generate-hash.ts` (bcrypt hash utility), `scripts/build-docker.sh` (see below).

## Docker / deployment

- **`provisioning/Dockerfile`** — two-stage: `node:24` builder (`pnpm install --frozen-lockfile`, build shared + server) → `node:24-slim` runtime with `server/dist`, `server/migrations`, `server/fixtures`, `shared/dist` and `shared/data`. Exposes 3001, `CMD pnpm --filter server start`.
- **`scripts/build-docker.sh`** — manual fallback; builds/pushes `maelstromeous/albionroads:latest` (linux/amd64), pass `test` for the `:testing-latest` tag. The `:latest` image is normally published by CI (below).
- **`provisioning/docker-compose.yml`** — services: `db` (postgres:16-alpine, port 5432, bind mount `provisioning/volumes/db-data/`), `server` (prod image, :3001), `server-testing` (testing image, host :3002, uses `DATABASE_URL_TESTING`).
- Client deploys to Vercel; the server image runs behind a Cloudflare tunnel. `/metrics` is IP-allowlisted to localhost + `10.0.1.0/24` (Prometheus scrape network) — the tunnel subnet is deliberately blocked.

### Backend CI/CD

Merging a backend change to `main` publishes the image and redeploys the server; nothing is built or SSH'd by hand.

| Workflow | Trigger | Does |
|---|---|---|
| `test.yml` (*Tests*) | PR, push to `main`, `workflow_call` | unit suites + `pnpm build` |
| `pr-docker.yml` (*Docker Build*) | PR touching backend paths | builds the image without pushing |
| `docker-build-push.yml` (*Build & Publish*) | `workflow_call` only | builds; when `push: true`, publishes the channel's moving tag + a SHA-pinned tag |
| `deploy-backend.yml` (*Backend Deployment*) | push to `main` on backend paths, or manual | Tests → Build & Publish → Trigger Deployment Webhook |
| `deploy-testing.yml` (*Testing Deployment*) | push to `testing` on backend paths, or manual | same chain, publishing the testing channel |
| `deploy.yml` (*Trigger Deployment Webhook*) | `workflow_call` only | HMAC-signed POST to the webhook host |

**Channels.** `docker-build-push.yml` takes a `channel` input (`production` by default):

| Channel | Moving tag | Pinned tag | Consumed by |
|---|---|---|---|
| `production` | `:latest` | `:<sha>` | `server` on :3001 |
| `testing` | `:testing-latest` | `:testing-<sha>` | `server-testing` on :3002, behind `api-testing.albionroads.live` |

`testing` is a deploy target rather than a line of development — reset it onto whatever you want on :3002 and force-push (`git push --force origin HEAD:testing`). Both channels call the same webhook, because `/root/update.sh` pulls every image in the compose file; production is only recreated if its own digest changed.

- **Backend paths** (shared by the deploy and PR-docker triggers): `web/server/**`, `web/shared/**`, `provisioning/**`, `.dockerignore`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.github/workflows/**`. Client-only changes deploy through Vercel and never touch this pipeline.
- **Client paths.** Vercel is driven by its own Git integration, not by anything in `.github/`, so it has to be filtered separately: `ignoreCommand` in `web/client/vercel.json` skips the build unless the commit touched `web/client/**`, `web/shared/**`, root `package.json`, `pnpm-lock.yaml` or `pnpm-workspace.yaml`. `git diff --quiet` exits `0` when nothing matched, which is Vercel's "skip"; anything else, including a missing `HEAD^`, builds. It compares `HEAD^..HEAD` only, so on a preview a client change in an earlier commit of the same branch will not be rebuilt by a later docs-only push.
- **The webhook** hits [`Maelstromeous/webhooks`](https://github.com/Maelstromeous/webhooks), whose `albionroads` hook SSHes to the server and runs `/root/update.sh`. The hook is chosen by URL path; the body is only what the HMAC signature covers.
- **There is no deploy script on the server.** The webhooks repo pipes one shared `update.sh` over SSH for every project, so nothing here needs installing or syncing to the box. This repo only supplies the compose file's service names — `server` and `server-testing` — which are configured in that repo's hook entry.
- **`provisioning/docker-compose.yml` mirrors `/root/docker/docker-compose.yml` on the server, and nothing syncs it.** Changing it here changes nothing there until it is copied over. The two had drifted far enough that a dead `MEDIA_PATH` variable survived on the box, so check both when changing either.
- **A green deploy does not mean the deploy worked** — the webhook returns `200` before the SSH happens and never reports its exit code. `ssh root@albionroads.public.lan 'tail -20 /root/deploy.log'` is the confirmation. Look for `updated <old> -> <new>` per service and a health status; `unchanged` means the pull found nothing.
- **Required repo secrets:** `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `WEBHOOK_URL` (…`/hooks/albionroads`), `WEBHOOK_SECRET`.
- **Rolling back:** every build is also tagged `maelstromeous/albionroads:<commit sha>` — repoint the compose file at one and recreate.
- Deploys are serialised by a `deploy-backend` concurrency group and are never cancelled mid-flight.

## Releasing

- Version lives in root `package.json`; the client displays it via `__APP_VERSION__`.
- `pnpm changelog` drives `CHANGELOG.md` via git-cliff (`cliff.toml`); commits follow conventional-commit style (`fix:`, `feat:` — see git log).
