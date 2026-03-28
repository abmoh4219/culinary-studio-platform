# Culinary Studio Operations & Recipe Coach Platform

## Start

```bash
docker compose up --build
```

To run in detached mode:

```bash
docker compose up --build -d
```

## URLs

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000/api/v1`
- Swagger UI: `http://localhost:4000/api/docs`
- PostgreSQL: internal Docker network only (`postgres:5432`)
- Redis: internal Docker network only (`redis:6379`)

## Verify

```bash
curl -sS http://localhost:4000/health
curl -sS http://localhost:4000/health/ready
curl -sS http://localhost:4000/api/v1/health
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:5173
curl -sS -X POST http://localhost:4000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"qa.admin@culinary.local","password":"QaAdminPass123!"}'
```

Inspect compose health:

```bash
docker compose ps
```

## QA Login

Use the sign-in Email field with the seeded username string exactly as-is: admin `qa.admin@culinary.local` (password `QaAdminPass123!`) or member `qa.member@culinary.local` (password `QaMemberPass123!`); the login API field name is `username`, not `email`. QA requires seeded users (`SEED=1` in `.env.qa`): browser calls use `PUBLIC_API_BASE_URL=http://localhost:4000/api/v1`, while server-side frontend loads use `API_INTERNAL_BASE_URL=http://backend:4000/api/v1` in Docker.

## HTTPS

Default dev/QA uses HTTP only. If you need local HTTPS, front the stack with a local TLS terminator (for example Caddy or Nginx) and forward to the services above.

### TLS on LAN (Caddy profile)

The repo includes a Caddy profile at `infra/tls/Caddyfile` so QA can run HTTPS on LAN:

```bash
AUTH_COOKIE_SECURE=true \
TRUST_PROXY=true \
CORS_ORIGIN=https://localhost \
PUBLIC_API_BASE_URL=https://localhost/api/v1 \
docker compose --profile tls up --build
```

- HTTPS entrypoint: `https://localhost`
- API under proxy: `https://localhost/api/v1`
- Caddy uses `tls internal` (local CA). Import/trust Caddy's local CA on test devices for browser trust.
- `AUTH_COOKIE_SECURE=true` ensures auth cookies stay Secure under TLS.
- `TRUST_PROXY=true` enables correct proxy-aware request handling behind TLS termination.

## LAN / Offline

- Services bind to `0.0.0.0` for LAN access.
- CORS is configured via compose env (`CORS_ORIGIN` in `.env.qa`).
- Frontend API base is `http://localhost:4000/api/v1` by default.
- No cloud runtime dependencies are required.

## Verified Runtime Guarantee

- `docker compose up --build` starts PostgreSQL, Redis, backend, and frontend without manual container edits.
- Backend startup is deterministic: env validation runs on startup, and Docker entrypoint waits for database readiness before migrations/start.
- Compose healthchecks are enabled for PostgreSQL and backend readiness (`/health/ready`).
- `/health/ready` returns structured readiness JSON with config/database/redis checks.

## At-Rest Encryption

- Backend encrypted columns (`*Ciphertext` + `*Iv`) use AES-256-GCM with `FIELD_ENCRYPTION_KEY`.
- `FIELD_ENCRYPTION_KEY` must be either a raw 32-byte UTF-8 string or base64 for 32 bytes.
- In production, missing/invalid `FIELD_ENCRYPTION_KEY` fails encrypted read/write paths with a clear configuration error.
- Backward-compatibility migration window: set `FIELD_ENCRYPTION_ALLOW_PLAINTEXT_FALLBACK=true` to dual-read legacy rows written as plaintext; after backfill/rewrite, set it back to `false`.

## Error and Logging Contract

- API error responses use JSON shape: `{ "message": string, "code"?: string, "details"?: unknown }`.
- Validation failures return `400` with `code: "VALIDATION_ERROR"`.
- In production (`NODE_ENV=production`), unknown server errors return generic `500` message (`Internal server error`) with no stack output.
- Logs include stable request fields via structured logger context: `correlationId`, `module`, `action`, and `userId` when authenticated.
- Logging levels: successful mutations/notable auth outcomes `info`; relevant 4xx `warn`; unexpected failures/5xx `error`.
- Never log secrets or credentials: passwords, bearer tokens, `Authorization`, cookies, and token-like sensitive payload fields are redacted.

## Tests

```bash
./run_tests.sh
```

Individual suites:

```bash
npm run test:unit --workspace backend
npm run test:api --workspace backend
npm run test:unit --workspace frontend
```

Test env variables (defaults are set by `run_tests.sh`): `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FIELD_ENCRYPTION_KEY`, `SECURITY_ACTION_PATH_PREFIXES`.

Real (non-mocked) backend integration path (opt-in):

```bash
RUN_REAL_INTEGRATION=true REAL_INTEGRATION_DATABASE_URL="postgresql://..." npm run test:api --workspace backend
```

This runs a dedicated test that creates an isolated schema, applies Prisma migrations, seeds a minimal admin user, then exercises `/api/v1/auth/login` and a signed/idempotent protected mutation through the real app stack.
