#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

export DATABASE_URL="${DATABASE_URL:-postgresql://test:test@localhost:5432/test?schema=public}"
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
