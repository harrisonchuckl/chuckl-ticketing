-- CreateEnum
CREATE TYPE "ShowEventType" AS ENUM ('VIEW', 'ADD_TO_CART', 'CHECKOUT_START', 'PAID');

-- CreateTable
CREATE TABLE "ShowEvent" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "type" "ShowEventType" NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT,
    "orderId" TEXT,

    CONSTRAINT "ShowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedConfig" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "slotCount" INTEGER NOT NULL,
    "weights" JSONB NOT NULL,
    "exclusions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeaturedConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedPin" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "regionCounty" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeaturedPin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedRegionRule" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "weightsOverride" JSONB,
    "exclusionsOverride" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeaturedRegionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedDecisionLog" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "county" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "results" JSONB NOT NULL,

    CONSTRAINT "FeaturedDecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAiDraft" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "showId" TEXT,
    "channel" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceTemplateId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAiDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAiTemplate" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "conditions" JSONB,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAiTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAiTonePreset" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rules" JSONB,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAiTonePreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAiDraftPerformance" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "platform" TEXT,
    "metrics" JSONB,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAiDraftPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedConfig_organiserId_key" ON "FeaturedConfig"("organiserId");

-- CreateIndex
CREATE INDEX "FeaturedPin_organiserId_idx" ON "FeaturedPin"("organiserId");

-- CreateIndex
CREATE INDEX "FeaturedPin_showId_idx" ON "FeaturedPin"("showId");

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedRegionRule_organiserId_county_key" ON "FeaturedRegionRule"("organiserId", "county");

-- CreateIndex
CREATE INDEX "FeaturedRegionRule_organiserId_idx" ON "FeaturedRegionRule"("organiserId");

-- CreateIndex
CREATE INDEX "FeaturedDecisionLog_organiserId_computedAt_idx" ON "FeaturedDecisionLog"("organiserId", "computedAt");

-- CreateIndex
CREATE INDEX "ShowEvent_showId_ts_idx" ON "ShowEvent"("showId", "ts");

-- CreateIndex
CREATE INDEX "ShowEvent_type_ts_idx" ON "ShowEvent"("type", "ts");

-- CreateIndex
CREATE INDEX "MarketingAiDraft_organiserId_idx" ON "MarketingAiDraft"("organiserId");

-- CreateIndex
CREATE INDEX "MarketingAiDraft_showId_idx" ON "MarketingAiDraft"("showId");

-- CreateIndex
CREATE INDEX "MarketingAiTemplate_organiserId_idx" ON "MarketingAiTemplate"("organiserId");

-- CreateIndex
CREATE INDEX "MarketingAiTonePreset_organiserId_idx" ON "MarketingAiTonePreset"("organiserId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAiDraftPerformance_draftId_key" ON "MarketingAiDraftPerformance"("draftId");

-- AddForeignKey
ALTER TABLE "ShowEvent" ADD CONSTRAINT "ShowEvent_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedConfig" ADD CONSTRAINT "FeaturedConfig_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedPin" ADD CONSTRAINT "FeaturedPin_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedPin" ADD CONSTRAINT "FeaturedPin_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedRegionRule" ADD CONSTRAINT "FeaturedRegionRule_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedDecisionLog" ADD CONSTRAINT "FeaturedDecisionLog_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAiDraft" ADD CONSTRAINT "MarketingAiDraft_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAiDraft" ADD CONSTRAINT "MarketingAiDraft_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAiDraft" ADD CONSTRAINT "MarketingAiDraft_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "MarketingAiTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAiDraft" ADD CONSTRAINT "MarketingAiDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAiTemplate" ADD CONSTRAINT "MarketingAiTemplate_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAiTonePreset" ADD CONSTRAINT "MarketingAiTonePreset_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAiDraftPerformance" ADD CONSTRAINT "MarketingAiDraftPerformance_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "MarketingAiDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
