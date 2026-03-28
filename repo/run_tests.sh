#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

REAL_TEST_DB_PORT="${REAL_TEST_DB_PORT:-55432}"
REAL_TEST_DB_NAME="${REAL_TEST_DB_NAME:-test}"
REAL_TEST_DB_USER="${REAL_TEST_DB_USER:-test}"
REAL_TEST_DB_PASSWORD="${REAL_TEST_DB_PASSWORD:-test}"
REAL_TEST_DB_CONTAINER="${REAL_TEST_DB_CONTAINER:-culinary-real-test-postgres}"

cleanup() {
  docker rm -f "$REAL_TEST_DB_CONTAINER" >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "[setup] Starting isolated PostgreSQL test container"
cleanup
docker run -d \
  --name "$REAL_TEST_DB_CONTAINER" \
  -e POSTGRES_DB="$REAL_TEST_DB_NAME" \
  -e POSTGRES_USER="$REAL_TEST_DB_USER" \
  -e POSTGRES_PASSWORD="$REAL_TEST_DB_PASSWORD" \
  -p "$REAL_TEST_DB_PORT:5432" \
  postgres:16-alpine >/dev/null

echo "[setup] Waiting for PostgreSQL readiness"
for i in $(seq 1 30); do
  if docker exec "$REAL_TEST_DB_CONTAINER" pg_isready -U "$REAL_TEST_DB_USER" -d "$REAL_TEST_DB_NAME" >/dev/null 2>&1; then
    break
  fi

  if [ "$i" -eq 30 ]; then
    echo "PostgreSQL test container failed to become ready" >&2
    exit 1
  fi
  sleep 1
done

export DATABASE_URL="postgresql://${REAL_TEST_DB_USER}:${REAL_TEST_DB_PASSWORD}@localhost:${REAL_TEST_DB_PORT}/${REAL_TEST_DB_NAME}?schema=public"
export REAL_INTEGRATION_DATABASE_URL="$DATABASE_URL"
export RUN_REAL_INTEGRATION="true"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-test_access_secret}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-test_refresh_secret}"
export SECURITY_ACTION_PATH_PREFIXES="${SECURITY_ACTION_PATH_PREFIXES:-/__disabled__}"

echo "[1/3] Backend unit tests"
npm run test:unit --workspace backend

echo "[2/3] Backend API tests"
npm run test:api --workspace backend

echo "[3/3] Frontend unit tests"
npm run test:unit --workspace frontend

echo "All test suites completed successfully."
echo "Summary: total=3 passed=3 failed=0"
