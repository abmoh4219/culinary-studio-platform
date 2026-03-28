# Culinary Studio Operations & Recipe Coach Platform

## Start

```bash
docker compose up --build
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
curl -sS http://localhost:4000/api/v1/health
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:5173
curl -sS -X POST http://localhost:4000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"qa.admin@culinary.local","password":"QaAdminPass123!"}'
```

## QA Login

Use the sign-in Email field with the seeded username string exactly as-is: admin `qa.admin@culinary.local` (password `QaAdminPass123!`) or member `qa.member@culinary.local` (password `QaMemberPass123!`); the login API field name is `username`, not `email`. QA requires seeded users (`SEED=1` in `.env.qa`): browser calls use `PUBLIC_API_BASE_URL=http://localhost:4000/api/v1`, while server-side frontend loads use `API_INTERNAL_BASE_URL=http://backend:4000/api/v1` in Docker.

## HTTPS

Default dev/QA uses HTTP only. If you need local HTTPS, front the stack with a local TLS terminator (for example Caddy or Nginx) and forward to the services above.

## LAN / Offline

- Services bind to `0.0.0.0` for LAN access.
- CORS is configured via compose env (`CORS_ORIGIN` in `.env.qa`).
- Frontend API base is `http://localhost:4000/api/v1` by default.
- No cloud runtime dependencies are required.

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

Test env variables (defaults are set by `run_tests.sh`): `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SECURITY_ACTION_PATH_PREFIXES`.
