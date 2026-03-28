ALTER TABLE "User"
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);

ALTER TABLE "User"
  ADD CONSTRAINT "User_failedLoginAttempts_non_negative_check"
  CHECK ("failedLoginAttempts" >= 0);

CREATE INDEX "User_lockedUntil_idx" ON "User"("lockedUntil");
