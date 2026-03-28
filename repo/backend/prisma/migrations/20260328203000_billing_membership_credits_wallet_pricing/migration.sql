CREATE TYPE "MembershipEnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELED', 'EXPIRED');

CREATE TABLE "MembershipEnrollment" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "membershipPlanId" UUID NOT NULL,
  "priceBookId" UUID,
  "priceBookItemId" UUID,
  "status" "MembershipEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "autoRenew" BOOLEAN NOT NULL DEFAULT FALSE,
  "nextBillingAt" TIMESTAMP(3),
  "lastChargedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MembershipEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditPackGrant" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "creditPackId" UUID NOT NULL,
  "priceBookId" UUID,
  "priceBookItemId" UUID,
  "creditsTotal" INTEGER NOT NULL,
  "creditsRemaining" INTEGER NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditPackGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MembershipEnrollment_userId_status_endsAt_idx"
ON "MembershipEnrollment"("userId", "status", "endsAt");

CREATE INDEX "MembershipEnrollment_membershipPlanId_status_idx"
ON "MembershipEnrollment"("membershipPlanId", "status");

CREATE INDEX "MembershipEnrollment_nextBillingAt_idx"
ON "MembershipEnrollment"("nextBillingAt");

CREATE INDEX "CreditPackGrant_userId_expiresAt_idx"
ON "CreditPackGrant"("userId", "expiresAt");

CREATE INDEX "CreditPackGrant_creditPackId_grantedAt_idx"
ON "CreditPackGrant"("creditPackId", "grantedAt");

CREATE INDEX "CreditPackGrant_creditsRemaining_idx"
ON "CreditPackGrant"("creditsRemaining");

ALTER TABLE "MembershipEnrollment"
  ADD CONSTRAINT "MembershipEnrollment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MembershipEnrollment"
  ADD CONSTRAINT "MembershipEnrollment_membershipPlanId_fkey"
  FOREIGN KEY ("membershipPlanId") REFERENCES "MembershipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MembershipEnrollment"
  ADD CONSTRAINT "MembershipEnrollment_priceBookId_fkey"
  FOREIGN KEY ("priceBookId") REFERENCES "PriceBook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MembershipEnrollment"
  ADD CONSTRAINT "MembershipEnrollment_priceBookItemId_fkey"
  FOREIGN KEY ("priceBookItemId") REFERENCES "PriceBookItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreditPackGrant"
  ADD CONSTRAINT "CreditPackGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CreditPackGrant"
  ADD CONSTRAINT "CreditPackGrant_creditPackId_fkey"
  FOREIGN KEY ("creditPackId") REFERENCES "CreditPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CreditPackGrant"
  ADD CONSTRAINT "CreditPackGrant_priceBookId_fkey"
  FOREIGN KEY ("priceBookId") REFERENCES "PriceBook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreditPackGrant"
  ADD CONSTRAINT "CreditPackGrant_priceBookItemId_fkey"
  FOREIGN KEY ("priceBookItemId") REFERENCES "PriceBookItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MembershipEnrollment"
  ADD CONSTRAINT "MembershipEnrollment_dates_check"
  CHECK ("endsAt" > "startsAt");

ALTER TABLE "CreditPackGrant"
  ADD CONSTRAINT "CreditPackGrant_credits_check"
  CHECK ("creditsTotal" > 0 AND "creditsRemaining" >= 0 AND "creditsRemaining" <= "creditsTotal");
