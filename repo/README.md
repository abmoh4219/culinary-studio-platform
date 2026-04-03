# Culinary Studio Operations & Recipe Coach Platform

## Run Everything (TLS Default)

Start the secure default stack (Caddy TLS proxy + backend + frontend + infra):

```bash
docker compose --profile tls up --build
```

For local HTTP-only development without TLS termination, use:

```bash
docker compose up --build
```

Stop the stack:

```bash
docker compose down
```

Stop the stack and remove volumes:

```bash
docker compose down -v
```

## Seeded Login Credentials

- Admin username: `qa.admin@culinary.local`
- Admin password: `QaAdminPass123!`
- Member username: `qa.member@culinary.local`
- Member password: `QaMemberPass123!`

Use the backend `username` field exactly as shown above when signing in.
