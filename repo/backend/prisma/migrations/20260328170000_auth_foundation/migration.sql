ALTER TABLE "User"
  ALTER COLUMN "emailHash" DROP NOT NULL;

ALTER TABLE "User"
  ADD COLUMN "consentGranted" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "consentGrantedAt" TIMESTAMP(3);

ALTER TABLE "User"
  ADD CONSTRAINT "User_consent_timestamp_check"
  CHECK (
    ("consentGranted" = TRUE AND "consentGrantedAt" IS NOT NULL)
    OR
    ("consentGranted" = FALSE AND "consentGrantedAt" IS NULL)
  );

CREATE INDEX "User_consentGranted_idx" ON "User"("consentGranted");
CREATE INDEX "User_consentGrantedAt_idx" ON "User"("consentGrantedAt");
