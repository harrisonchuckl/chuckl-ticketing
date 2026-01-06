-- Marketing suite enhancements (templates, automations, send snapshots, brand settings)

ALTER TABLE "MarketingSettings" ADD COLUMN IF NOT EXISTS "brandLogoUrl" TEXT;
ALTER TABLE "MarketingSettings" ADD COLUMN IF NOT EXISTS "brandDefaultFont" TEXT;
ALTER TABLE "MarketingSettings" ADD COLUMN IF NOT EXISTS "brandPrimaryColor" TEXT;
ALTER TABLE "MarketingSettings" ADD COLUMN IF NOT EXISTS "brandButtonRadius" INTEGER;

ALTER TABLE "MarketingTemplate" ADD COLUMN IF NOT EXISTS "editorType" TEXT NOT NULL DEFAULT 'GRAPESJS';
ALTER TABLE "MarketingTemplate" ADD COLUMN IF NOT EXISTS "editorStateJson" JSONB;
ALTER TABLE "MarketingTemplate" ADD COLUMN IF NOT EXISTS "compiledHtml" TEXT;
ALTER TABLE "MarketingTemplate" ADD COLUMN IF NOT EXISTS "compiledText" TEXT;
ALTER TABLE "MarketingTemplate" ADD COLUMN IF NOT EXISTS "lastCompiledAt" TIMESTAMP;
ALTER TABLE "MarketingTemplate" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "MarketingAutomation" ADD COLUMN IF NOT EXISTS "flowJson" JSONB;
ALTER TABLE "MarketingAutomation" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "MarketingSendSnapshot" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "renderedHtml" TEXT NOT NULL,
  "renderedText" TEXT,
  "mergeContext" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingSendSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketingSendSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MarketingSendSnapshot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MarketingSendSnapshot_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MarketingSendSnapshot_tenantId_campaignId_idx" ON "MarketingSendSnapshot"("tenantId", "campaignId");
CREATE INDEX IF NOT EXISTS "MarketingSendSnapshot_tenantId_templateId_idx" ON "MarketingSendSnapshot"("tenantId", "templateId");
