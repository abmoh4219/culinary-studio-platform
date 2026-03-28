CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

CREATE TABLE "SignedRequestReplay" (
  "id" UUID NOT NULL,
  "userId" UUID,
  "scopeKey" VARCHAR(140) NOT NULL,
  "nonce" VARCHAR(120) NOT NULL,
  "requestSignatureHash" VARCHAR(128) NOT NULL,
  "canonicalHash" VARCHAR(128) NOT NULL,
  "requestTimestamp" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SignedRequestReplay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdempotencyKey" (
  "id" UUID NOT NULL,
  "userId" UUID,
  "scopeKey" VARCHAR(140) NOT NULL,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "method" VARCHAR(10) NOT NULL,
  "path" VARCHAR(255) NOT NULL,
  "requestHash" VARCHAR(128) NOT NULL,
  "status" "IdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "responseStatus" INTEGER,
  "responseBody" JSONB,
  "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SignedRequestReplay_scopeKey_nonce_key"
ON "SignedRequestReplay"("scopeKey", "nonce");

CREATE INDEX "SignedRequestReplay_userId_createdAt_idx"
ON "SignedRequestReplay"("userId", "createdAt");

CREATE INDEX "SignedRequestReplay_expiresAt_idx"
ON "SignedRequestReplay"("expiresAt");

CREATE UNIQUE INDEX "IdempotencyKey_scopeKey_idempotencyKey_method_path_key"
ON "IdempotencyKey"("scopeKey", "idempotencyKey", "method", "path");

CREATE INDEX "IdempotencyKey_userId_createdAt_idx"
ON "IdempotencyKey"("userId", "createdAt");

CREATE INDEX "IdempotencyKey_status_expiresAt_idx"
ON "IdempotencyKey"("status", "expiresAt");

ALTER TABLE "SignedRequestReplay"
  ADD CONSTRAINT "SignedRequestReplay_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IdempotencyKey"
  ADD CONSTRAINT "IdempotencyKey_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SignedRequestReplay"
  ADD CONSTRAINT "SignedRequestReplay_expires_after_created_check"
  CHECK ("expiresAt" > "createdAt");

ALTER TABLE "IdempotencyKey"
  ADD CONSTRAINT "IdempotencyKey_expires_after_created_check"
  CHECK ("expiresAt" > "createdAt");
