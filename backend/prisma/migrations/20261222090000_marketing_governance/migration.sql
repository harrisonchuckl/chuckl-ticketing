-- Marketing governance additions

DO $$ BEGIN
  CREATE TYPE "MarketingGovernanceRole" AS ENUM ('VIEWER', 'CAMPAIGN_CREATOR', 'APPROVER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MarketingTemplateChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "MarketingTemplate"
  ADD COLUMN IF NOT EXISTS "previewText" TEXT,
  ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lockedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "lockReason" TEXT;

ALTER TABLE "MarketingCampaign"
  ADD COLUMN IF NOT EXISTS "scheduledByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);

ALTER TABLE "MarketingAuditLog"
  ADD COLUMN IF NOT EXISTS "actorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "actorEmail" TEXT;

CREATE TABLE IF NOT EXISTS "MarketingTemplateVersion" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "previewText" TEXT,
  "fromName" TEXT NOT NULL,
  "fromEmail" TEXT NOT NULL,
  "replyTo" TEXT,
  "mjmlBody" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MarketingTemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MarketingTemplateVersion_templateId_version_idx" ON "MarketingTemplateVersion"("templateId", "version");

CREATE TABLE IF NOT EXISTS "MarketingTemplateChangeRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "status" "MarketingTemplateChangeStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "message" TEXT,
  "requestedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),

  CONSTRAINT "MarketingTemplateChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MarketingTemplateChangeRequest_tenantId_status_idx" ON "MarketingTemplateChangeRequest"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "MarketingTemplateChangeRequest_templateId_idx" ON "MarketingTemplateChangeRequest"("templateId");

CREATE TABLE IF NOT EXISTS "MarketingRoleAssignment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "MarketingGovernanceRole" NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingRoleAssignment_tenantId_userId_key" ON "MarketingRoleAssignment"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "MarketingRoleAssignment_tenantId_idx" ON "MarketingRoleAssignment"("tenantId");
CREATE INDEX IF NOT EXISTS "MarketingRoleAssignment_userId_idx" ON "MarketingRoleAssignment"("userId");

ALTER TABLE "MarketingTemplate"
  ADD CONSTRAINT "MarketingTemplate_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingTemplateVersion"
  ADD CONSTRAINT "MarketingTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MarketingTemplateVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingTemplateChangeRequest"
  ADD CONSTRAINT "MarketingTemplateChangeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MarketingTemplateChangeRequest_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MarketingTemplateChangeRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MarketingTemplateChangeRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingCampaign"
  ADD CONSTRAINT "MarketingCampaign_scheduledByUserId_fkey" FOREIGN KEY ("scheduledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MarketingCampaign_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingAuditLog"
  ADD CONSTRAINT "MarketingAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingRoleAssignment"
  ADD CONSTRAINT "MarketingRoleAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MarketingRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
