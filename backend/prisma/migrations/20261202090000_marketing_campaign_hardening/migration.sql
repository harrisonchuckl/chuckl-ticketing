-- AlterEnum
ALTER TYPE "MarketingCampaignStatus" ADD VALUE IF NOT EXISTS 'PAUSED_LIMIT';
ALTER TYPE "MarketingCampaignStatus" ADD VALUE IF NOT EXISTS 'FAILED';

-- AlterEnum
ALTER TYPE "MarketingRecipientStatus" ADD VALUE IF NOT EXISTS 'RETRYABLE';

-- AlterTable
ALTER TABLE "MarketingCampaign" ADD COLUMN IF NOT EXISTS "recipientsPreparedAt" TIMESTAMP(3);
ALTER TABLE "MarketingCampaign" ADD COLUMN IF NOT EXISTS "sendLockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MarketingCampaignRecipient" ADD COLUMN IF NOT EXISTS "retryAt" TIMESTAMP(3);
ALTER TABLE "MarketingCampaignRecipient" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MarketingCampaignRecipient" ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MarketingDailySendCounter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingDailySendCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MarketingWorkerState" (
    "id" TEXT NOT NULL,
    "lastWorkerRunAt" TIMESTAMP(3),
    "lastSendAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingWorkerState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingDailySendCounter_tenantId_day_key" ON "MarketingDailySendCounter"("tenantId", "day");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MarketingDailySendCounter_tenantId_day_idx" ON "MarketingDailySendCounter"("tenantId", "day");

-- AddForeignKey
ALTER TABLE "MarketingDailySendCounter" ADD CONSTRAINT "MarketingDailySendCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
