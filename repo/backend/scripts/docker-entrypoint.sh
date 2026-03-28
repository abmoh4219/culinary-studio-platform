#!/bin/sh
set -eu

echo "[backend] Waiting for database readiness"
node -e "
const { PrismaClient } = require('./prisma/generated');
const prisma = new PrismaClient();
const attempts = Number(process.env.DB_WAIT_MAX_ATTEMPTS || 30);
const delayMs = Number(process.env.DB_WAIT_DELAY_MS || 2000);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      console.log('[backend] Database is ready');
      await prisma.$disconnect();
      return;
    } catch (error) {
      console.log('[backend] Database not ready (attempt ' + i + '/' + attempts + ')');
      if (i === attempts) {
        await prisma.$disconnect();
        throw error;
      }
      await sleep(delayMs);
    }
  }
}

main().catch((error) => {
  console.error('[backend] Failed waiting for database', error?.message || error);
  process.exit(1);
});
"

echo "[backend] Generating Prisma client"
npm run prisma:generate

echo "[backend] Applying migrations"
npm run prisma:migrate:deploy

if [ "${SEED:-0}" = "1" ] || [ "${SEED:-0}" = "true" ]; then
  echo "[backend] Running QA seed"
  npm run seed:qa
else
  echo "[backend] Skipping QA seed (SEED not enabled)"
fi

echo "[backend] Starting API"
node dist/server.js
