#!/bin/sh
set -e

echo "[backend] Waiting for PostgreSQL readiness"
node <<'NODE'
const { PrismaClient } = require('./prisma/generated');

const prisma = new PrismaClient();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDatabase() {
  let attempt = 1;

  while (true) {
    try {
      await prisma.$connect();
      await prisma.$disconnect();
      console.log('[backend] PostgreSQL is reachable');
      return;
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      console.log('[backend] PostgreSQL not ready (attempt ' + attempt + '): ' + message);
      attempt += 1;
      await delay(1000);
    }
  }
}

waitForDatabase().catch(async (error) => {
  console.error('[backend] Failed waiting for PostgreSQL', error && error.message ? error.message : error);
  try {
    await prisma.$disconnect();
  } catch (_disconnectError) {
    // no-op
  }
  process.exit(1);
});
NODE

echo "[backend] Applying Prisma migrations"
npx prisma migrate deploy

echo "[backend] Seeding QA data"
node prisma/seed.qa.cjs || echo "[backend] QA seed skipped or already applied"

echo "[backend] Starting backend"
npm run start
