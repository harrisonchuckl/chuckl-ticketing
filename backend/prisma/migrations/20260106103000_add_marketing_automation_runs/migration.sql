-- 1) Add missing columns to MarketingAutomationState
ALTER TABLE "MarketingAutomationState"
  ADD COLUMN "runId" TEXT;

ALTER TABLE "MarketingAutomationState"
  ADD COLUMN "triggerKey" TEXT NOT NULL DEFAULT '';

-- 2) Update unique constraint to include triggerKey (matches Prisma schema)
ALTER TABLE "MarketingAutomationState"
  DROP CONSTRAINT IF EXISTS "MarketingAutomationState_tenantId_contactId_automationId_key";

ALTER TABLE "MarketingAutomationState"
  ADD CONSTRAINT "MarketingAutomationState_tenantId_contactId_automationId_triggerKey_key"
  UNIQUE ("tenantId", "contactId", "automationId", "triggerKey");

-- 3) Create MarketingAutomationRun table (missing entirely)
CREATE TABLE "MarketingAutomationRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "triggerType" "MarketingAutomationTriggerType" NOT NULL,
  "triggerKey" TEXT NOT NULL DEFAULT '',
  "status" "MarketingAutomationStateStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastStep" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,

  CONSTRAINT "MarketingAutomationRun_pkey" PRIMARY KEY ("id")
);

-- 4) Add foreign keys (align with Prisma relations)
ALTER TABLE "MarketingAutomationRun"
  ADD CONSTRAINT "MarketingAutomationRun_automationId_fkey"
  FOREIGN KEY ("automationId") REFERENCES "MarketingAutomation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketingAutomationRun"
  ADD CONSTRAINT "MarketingAutomationRun_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "MarketingContact"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5) Connect state -> run via FK (runId is nullable, so SET NULL on delete)
ALTER TABLE "MarketingAutomationState"
  ADD CONSTRAINT "MarketingAutomationState_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "MarketingAutomationRun"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 6) Indexes (match schema @@index)
CREATE INDEX "MarketingAutomationRun_tenantId_automationId_idx"
  ON "MarketingAutomationRun" ("tenantId", "automationId");

CREATE INDEX "MarketingAutomationRun_tenantId_contactId_idx"
  ON "MarketingAutomationRun" ("tenantId", "contactId");

CREATE INDEX "MarketingAutomationRun_tenantId_status_idx"
  ON "MarketingAutomationRun" ("tenantId", "status");
