-- Add marketing intelligent campaigns.

CREATE TYPE "MarketingIntelligentCampaignKind" AS ENUM ('MONTHLY_DIGEST', 'NEW_ON_SALE_BATCH', 'ALMOST_SOLD_OUT', 'ADDON_UPSELL');

CREATE TABLE "MarketingIntelligentCampaign" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "kind" "MarketingIntelligentCampaignKind" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "templateId" TEXT NOT NULL,
  "configJson" JSONB NOT NULL,
  "lastRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingIntelligentCampaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketingIntelligentCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MarketingIntelligentCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "MarketingIntelligentCampaign_tenantId_idx" ON "MarketingIntelligentCampaign"("tenantId");
CREATE INDEX "MarketingIntelligentCampaign_templateId_idx" ON "MarketingIntelligentCampaign"("templateId");
