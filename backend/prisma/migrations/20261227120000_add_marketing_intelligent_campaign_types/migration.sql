-- Add marketing intelligent campaign types.

ALTER TABLE "MarketingIntelligentCampaign" ALTER COLUMN "kind" TYPE TEXT USING "kind"::text;

DROP TYPE "MarketingIntelligentCampaignKind";

CREATE TABLE "MarketingIntelligentCampaignType" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "strategyKey" TEXT NOT NULL,
  "defaultTemplateId" TEXT,
  "defaultConfigJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingIntelligentCampaignType_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketingIntelligentCampaignType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MarketingIntelligentCampaignType_defaultTemplateId_fkey" FOREIGN KEY ("defaultTemplateId") REFERENCES "MarketingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MarketingIntelligentCampaignType_tenantId_key_key" ON "MarketingIntelligentCampaignType"("tenantId", "key");
CREATE INDEX "MarketingIntelligentCampaignType_tenantId_idx" ON "MarketingIntelligentCampaignType"("tenantId");
