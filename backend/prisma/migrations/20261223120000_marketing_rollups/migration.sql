-- Marketing rollups, receipts, and indexes

CREATE TABLE IF NOT EXISTS "MarketingDailyEventRollup" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "day" TIMESTAMP(3) NOT NULL,
  "sent" INTEGER NOT NULL DEFAULT 0,
  "opened" INTEGER NOT NULL DEFAULT 0,
  "clicked" INTEGER NOT NULL DEFAULT 0,
  "bounced" INTEGER NOT NULL DEFAULT 0,
  "unsubscribed" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingDailyEventRollup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingDailyEventRollup_tenantId_day_key" ON "MarketingDailyEventRollup"("tenantId", "day");
CREATE INDEX IF NOT EXISTS "MarketingDailyEventRollup_tenantId_day_idx" ON "MarketingDailyEventRollup"("tenantId", "day");

CREATE TABLE IF NOT EXISTS "MarketingEmailEventReceipt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "eventAt" TIMESTAMP(3),
  "meta" JSONB,

  CONSTRAINT "MarketingEmailEventReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingEmailEventReceipt_provider_providerEventId_key" ON "MarketingEmailEventReceipt"("provider", "providerEventId");
CREATE INDEX IF NOT EXISTS "MarketingEmailEventReceipt_tenantId_receivedAt_idx" ON "MarketingEmailEventReceipt"("tenantId", "receivedAt");

CREATE INDEX IF NOT EXISTS "MarketingCampaignRecipient_tenantId_sentAt_idx" ON "MarketingCampaignRecipient"("tenantId", "sentAt");
CREATE INDEX IF NOT EXISTS "MarketingCampaignRecipient_status_idx" ON "MarketingCampaignRecipient"("status");

CREATE INDEX IF NOT EXISTS "MarketingEmailEvent_tenantId_type_createdAt_idx" ON "MarketingEmailEvent"("tenantId", "type", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingEmailEvent_tenantId_createdAt_idx" ON "MarketingEmailEvent"("tenantId", "createdAt");

ALTER TABLE "MarketingDailyEventRollup"
  ADD CONSTRAINT "MarketingDailyEventRollup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingEmailEventReceipt"
  ADD CONSTRAINT "MarketingEmailEventReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
