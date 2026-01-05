-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomerInsight" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "customerKey" TEXT NOT NULL,
    "firstPurchaseAt" TIMESTAMP(3),
    "lastPurchaseAt" TIMESTAMP(3),
    "purchaseCount" INTEGER NOT NULL DEFAULT 0,
    "purchaseCount90d" INTEGER NOT NULL DEFAULT 0,
    "ticketsBoughtLifetime" INTEGER NOT NULL DEFAULT 0,
    "avgTicketsPerOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "groupBuyerScore" BOOLEAN NOT NULL DEFAULT false,
    "monetaryValueLifetimePence" INTEGER NOT NULL DEFAULT 0,
    "monetaryValue90dPence" INTEGER NOT NULL DEFAULT 0,
    "recencyScore" INTEGER NOT NULL DEFAULT 0,
    "frequencyScore" INTEGER NOT NULL DEFAULT 0,
    "monetaryScore" INTEGER NOT NULL DEFAULT 0,
    "rfmSegment" TEXT,
    "favouriteVenueId" TEXT,
    "topVenueIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "favouriteCategory" TEXT,
    "favouriteEventType" TEXT,

    CONSTRAINT "CustomerInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomerInsightsWorkerState" (
    "id" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastRunCompletedAt" TIMESTAMP(3),
    "lastProcessedCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerInsightsWorkerState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerInsight_customerKey_key" ON "CustomerInsight"("customerKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerInsight_tenantId_idx" ON "CustomerInsight"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerInsight_email_idx" ON "CustomerInsight"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerInsight_customerAccountId_idx" ON "CustomerInsight"("customerAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerInsight_tenantId_email_idx" ON "CustomerInsight"("tenantId", "email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerInsight_tenantId_customerAccountId_idx" ON "CustomerInsight"("tenantId", "customerAccountId");

-- AddForeignKey
ALTER TABLE "CustomerInsight" ADD CONSTRAINT "CustomerInsight_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInsight" ADD CONSTRAINT "CustomerInsight_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
