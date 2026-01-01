-- CreateTable
CREATE TABLE "CampaignDraft" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "showId" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "riskLevel" TEXT,
    "timeToShowDays" INTEGER,
    "audienceRules" JSONB,
    "schedule" JSONB,
    "copySkeleton" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,

    CONSTRAINT "CampaignDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpsellBundle" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "showId" TEXT NOT NULL,
    "template" TEXT,
    "title" TEXT,
    "recommendedReason" TEXT,
    "items" JSONB,
    "status" TEXT,
    "createdByUserId" TEXT,

    CONSTRAINT "UpsellBundle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignDraft_showId_idx" ON "CampaignDraft"("showId");

-- CreateIndex
CREATE INDEX "CampaignDraft_createdByUserId_idx" ON "CampaignDraft"("createdByUserId");

-- CreateIndex
CREATE INDEX "UpsellBundle_showId_idx" ON "UpsellBundle"("showId");

-- CreateIndex
CREATE INDEX "UpsellBundle_createdByUserId_idx" ON "UpsellBundle"("createdByUserId");

-- AddForeignKey
ALTER TABLE "CampaignDraft" ADD CONSTRAINT "CampaignDraft_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDraft" ADD CONSTRAINT "CampaignDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpsellBundle" ADD CONSTRAINT "UpsellBundle_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpsellBundle" ADD CONSTRAINT "UpsellBundle_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
