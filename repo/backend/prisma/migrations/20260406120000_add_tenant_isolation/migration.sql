-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- AlterTable: Add tenantId to core models
ALTER TABLE "User" ADD COLUMN "tenantId" UUID;
ALTER TABLE "Booking" ADD COLUMN "tenantId" UUID;
ALTER TABLE "Invoice" ADD COLUMN "tenantId" UUID;
ALTER TABLE "WorkflowRun" ADD COLUMN "tenantId" UUID;
ALTER TABLE "Notification" ADD COLUMN "tenantId" UUID;
ALTER TABLE "WebhookConfig" ADD COLUMN "tenantId" UUID;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WebhookConfig" ADD CONSTRAINT "WebhookConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (tenant-scoped)
CREATE INDEX "User_tenantId_status_idx" ON "User"("tenantId", "status");
CREATE INDEX "Booking_tenantId_userId_startAt_idx" ON "Booking"("tenantId", "userId", "startAt");
CREATE INDEX "Invoice_tenantId_userId_status_issuedAt_idx" ON "Invoice"("tenantId", "userId", "status", "issuedAt");
CREATE INDEX "WorkflowRun_tenantId_recipeId_status_idx" ON "WorkflowRun"("tenantId", "recipeId", "status");
CREATE INDEX "Notification_tenantId_userId_createdAt_idx" ON "Notification"("tenantId", "userId", "createdAt");
CREATE INDEX "WebhookConfig_tenantId_eventKey_status_idx" ON "WebhookConfig"("tenantId", "eventKey", "status");

-- Seed default tenant and assign all existing users
INSERT INTO "Tenant" ("id", "slug", "name", "status", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'default', 'Default Studio', 'ACTIVE', NOW(), NOW());

UPDATE "User" SET "tenantId" = '00000000-0000-0000-0000-000000000001' WHERE "tenantId" IS NULL;
UPDATE "Booking" SET "tenantId" = '00000000-0000-0000-0000-000000000001' WHERE "tenantId" IS NULL;
-- Disable triggers on Invoice to bypass immutability check during data migration
ALTER TABLE "Invoice" DISABLE TRIGGER ALL;
UPDATE "Invoice" SET "tenantId" = '00000000-0000-0000-0000-000000000001' WHERE "tenantId" IS NULL;
ALTER TABLE "Invoice" ENABLE TRIGGER ALL;
UPDATE "WorkflowRun" SET "tenantId" = '00000000-0000-0000-0000-000000000001' WHERE "tenantId" IS NULL;
UPDATE "Notification" SET "tenantId" = '00000000-0000-0000-0000-000000000001' WHERE "tenantId" IS NULL;
UPDATE "WebhookConfig" SET "tenantId" = '00000000-0000-0000-0000-000000000001' WHERE "tenantId" IS NULL;
