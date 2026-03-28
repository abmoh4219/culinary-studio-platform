# Culinary Studio Operations & Recipe Coach Platform

Initial fullstack monorepo scaffold for an offline/LAN-capable platform.

## Tech Stack

- Frontend: SvelteKit + TypeScript + Tailwind CSS + shadcn-svelte
- Backend: Node.js + Fastify
- Database: PostgreSQL
- Queue/Cache: Redis
- ORM: Prisma
- Auth strategy: JWT in HttpOnly cookies (scaffold only)
- Containerization: Docker + Docker Compose

## Monorepo Layout

```text
.
├── API_tests/
├── backend/
├── docs/
├── frontend/
├── unit_tests/
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

## Quick Start

1. Copy environment template:

```bash
cp .env.example .env
```

2. Build and run all services:

```bash
docker compose up --build
```

3. Access services:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## LAN / Offline Notes

- Services are fully containerized and communicate on an internal Docker network.
- Backend and frontend bind to `0.0.0.0` for LAN accessibility.
- No cloud dependencies are required at runtime.
- First-time image/dependency pulls require internet access unless your Docker/npm caches are pre-warmed or mirrored locally.

## Local HTTPS Readiness

This scaffold is HTTP-first for local development, but it is ready to be fronted by TLS locally:

- Add a local reverse proxy container (for example Caddy or Nginx) that terminates TLS.
- Generate trusted local certificates with `mkcert` (or your internal CA).
- Route HTTPS traffic to:
  - frontend service on port `5173`
  - backend service on port `4000`
- Keep JWT cookies configured for `HttpOnly`; when enabling HTTPS, also enforce `Secure` cookies in backend auth configuration.

## Current Scope

- Included: project structure, tooling, container orchestration, base runtime wiring.
- Included: Prisma schema + initial SQL migration for users/roles, pricing, invoices, payments, wallets, and discount overrides.
- Intentionally excluded: business logic, API endpoints, UI pages.

## Database Migrations

- Prisma schema: `backend/prisma/schema.prisma`
- Initial migration: `backend/prisma/migrations/20260328130000_initial_billing_core/migration.sql`
- Booking/waitlist/workflow migration: `backend/prisma/migrations/20260328143000_booking_waitlist_workflow/migration.sql`
- Notifications/audit/webhooks migration: `backend/prisma/migrations/20260328153000_notifications_audit_webhooks/migration.sql`
- Auth foundation migration: `backend/prisma/migrations/20260328170000_auth_foundation/migration.sql`
- Security hardening migration: `backend/prisma/migrations/20260328183000_security_rbac_lockout_rate_limit/migration.sql`
- Signed request/idempotency migration: `backend/prisma/migrations/20260328193000_signed_requests_idempotency/migration.sql`
- Run local dev migration from `backend/`:

```bash
npm run prisma:migrate:dev
```

## Auth Foundation

- Routes:
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/logout`
  - `GET /auth/me` (JWT cookie protected)
- Role-protected route example:
  - `GET /auth/admin/health` (requires `ADMIN` role)
- Authentication uses JWT in `HttpOnly` cookie `access_token`.
- Passwords are hashed with Argon2id.
- Registration captures consent (`consentGranted` + `consentGrantedAt`) and applies data-minimization defaults.
- Account lockout: after 10 failed login attempts, account is locked for 15 minutes (configurable by env vars).
- Request rate limiting: 60 requests/minute keyed by authenticated user where possible, otherwise by IP.
- Signed requests for booking/billing action paths (`POST|PUT|PATCH|DELETE` on configured prefixes) require:
  - `X-Key-Id`
  - `X-Timestamp` (unix seconds)
  - `X-Nonce`
  - `X-Signature` (hex HMAC SHA-256)
- Signed request canonical string format:
  - `METHOD\nPATH\nTIMESTAMP\nNONCE\nUSER_ID_OR_EMPTY\nSHA256(STABLE_JSON_BODY)`
- Replay protection stores nonce scopes (`user:<id>` or `ip:<ip>`) and rejects reused nonces.
- Idempotency for booking/billing action paths requires `Idempotency-Key` and stores request/response outcomes for safe replay.
