# Culinary Studio Operations & Recipe Coach Platform

## Start

Acceptance/runtime path (TLS on LAN):

```bash
AUTH_COOKIE_SECURE=true \
TRUST_PROXY=true \
CORS_ORIGIN=https://localhost \
PUBLIC_API_BASE_URL=https://localhost/api/v1 \
docker compose --profile tls up --build
```

Non-TLS local developer path:

```bash
docker compose up --build
```

To run in detached mode:

```bash
docker compose up --build -d
```

## URLs

- TLS frontend: `https://localhost`
- TLS backend API: `https://localhost/api/v1`
- Direct frontend dev server: `http://localhost:5173`
- Direct backend API: `http://localhost:4000/api/v1`
- Swagger UI: development-only at `http://localhost:4000/api/docs`
- PostgreSQL: internal Docker network only (`postgres:5432`)
- Redis: internal Docker network only (`redis:6379`)

## Verify

```bash
curl -k -sS https://localhost/health
curl -k -sS https://localhost/health/ready
curl -k -sS https://localhost/api/v1/health
curl -k -sS -o /dev/null -w "%{http_code}\n" https://localhost
curl -k -sS -X POST https://localhost/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"qa.admin@culinary.local","password":"QaAdminPass123!"}'
```

Inspect compose health:

```bash
docker compose ps
```

## QA Login

Use the sign-in Email field with the seeded username string exactly as-is: admin `qa.admin@culinary.local` (password `QaAdminPass123!`) or member `qa.member@culinary.local` (password `QaMemberPass123!`); the login API field name is `username`, not `email`. QA requires seeded users (`SEED=1` in `.env.qa`): browser calls use `PUBLIC_API_BASE_URL=http://localhost:4000/api/v1`, while server-side frontend loads use `API_INTERNAL_BASE_URL=http://backend:4000/api/v1` in Docker.

- Member notification center: `/member/notifications`
- Front desk on-behalf booking: `/front-desk` create booking form supports customer `userId`; staff can book for members, while members remain scoped to themselves.

### TLS on LAN (Caddy profile)

The repo includes a Caddy profile at `infra/tls/Caddyfile` and this is the primary acceptance path for LAN/runtime verification:

```bash
AUTH_COOKIE_SECURE=true \
TRUST_PROXY=true \
CORS_ORIGIN=https://localhost \
PUBLIC_API_BASE_URL=https://localhost/api/v1 \
docker compose --profile tls up --build
```

- HTTPS entrypoint: `https://localhost`
- API under proxy: `https://localhost/api/v1`
- Health endpoints under proxy: `https://localhost/health` and `https://localhost/health/ready`
- Caddy uses `tls internal` (local CA). Import/trust Caddy's local CA on test devices for browser trust.
- `AUTH_COOKIE_SECURE=true` ensures auth cookies stay Secure under TLS.
- `TRUST_PROXY=true` enables correct proxy-aware request handling behind TLS termination.

## LAN / Offline

- Services bind to `0.0.0.0` for LAN access.
- CORS is configured via compose env (`CORS_ORIGIN` in `.env.qa`).
- Frontend API base is `https://localhost/api/v1` on the accepted TLS path.
- No cloud runtime dependencies are required.

## Verified Runtime Guarantee

- `docker compose up --build` starts PostgreSQL, Redis, backend, and frontend without manual container edits.
- Backend startup is deterministic: env validation runs on startup, and Docker entrypoint waits for database readiness before migrations/start.
- Compose healthchecks are enabled for PostgreSQL and backend readiness (`/health/ready`).
- `/health/ready` returns structured readiness JSON only in development; outside development it returns status-only readiness.
- Swagger/OpenAPI docs are development-only and are not exposed on the accepted production-like path.

## Runtime Proof

Expected startup logs include lines similar to:

- `[setup] Starting isolated PostgreSQL test container` (from `run_tests.sh`)
- `[backend] Waiting for database readiness`
- `[backend] Database is ready`
- `Starting backend service`

Expected readiness response on the accepted production-like path:

```json
{
  "status": "ready"
}
```

Expected readiness response in development:

```json
{
  "status": "ready",
  "checks": {
    "config": { "ok": true },
    "database": { "ok": true },
    "redis": { "ok": true }
  }
}
```

Sample runtime verification commands:

```bash
curl -k -sS https://localhost/health
curl -k -sS https://localhost/health/ready
curl -k -sS -X POST https://localhost/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"qa.admin@culinary.local","password":"QaAdminPass123!"}'
```

## Acceptance Proof

Covered domains in tests:

- auth
- booking
- billing
- workflow
- notification
- security middleware (signed requests, idempotency, rate limiting, lockout)
- frontend server-side protected mutation signing/idempotency

Coverage assurances include:

- authentication and account lockout behavior
- object-level authorization through HTTP routes
- booking lifecycle flows (create, conflict, waitlist, promotion, cancellation)
- billing rules and invoice persistence snapshots
- security enforcement (signature, idempotency, replay handling, rate limits)
- workflow booking reference authorization
- waitlist privacy/data minimization for non-staff users
- operational exposure controls for docs/readiness outside development
- webhook admin-only emit surface plus retry/dead-letter/failure-alert proof coverage
- front-desk/admin on-behalf booking creation with persisted `createdByUserId` vs booking owner proof

Example passing output snippet:

```text
[1/3] Backend unit tests
Test Files  14 passed (14)
[2/3] Backend API tests
Test Files  4 passed (4)
[3/3] Frontend unit tests
Test Files  3 passed (3)
Summary: total=3 passed=3 failed=0
```

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

Real (non-mocked) backend integration path (default):

```bash
./run_tests.sh
```

`run_tests.sh` always starts an isolated PostgreSQL container, runs Prisma migrations in a dedicated integration schema, and executes both mock-backed API tests and the real-stack integration suite. The real suite proves the golden path (auth, booking, waitlist promotion, cancellation, billing, notification history), object-level authorization, edge cases, idempotency, and encrypted-field behavior.
