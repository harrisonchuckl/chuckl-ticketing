-- DB catch-up for production:
-- Adds MarketingCampaign.type (enum) + showId + index + FK
-- Also creates MarketingAutomationStepType enum (present in prisma diff, likely next crash)
-- Source: /tmp/prisma-db-catchup.sql (generated via prisma migrate diff)

-- 1) Enums (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MarketingCampaignType') THEN
    CREATE TYPE "MarketingCampaignType" AS ENUM ('ONE_OFF', 'SHOW_REMINDER', 'ROUNDUP', 'ANNOUNCEMENT');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MarketingAutomationStepType') THEN
    CREATE TYPE "MarketingAutomationStepType" AS ENUM ('SEND_EMAIL', 'WAIT', 'BRANCH', 'ADD_TAG', 'UPDATE_PREFERENCE', 'NOTIFY_ORGANISER');
  END IF;
END $$;

-- 2) MarketingCampaign columns (idempotent)
ALTER TABLE "MarketingCampaign"
  ADD COLUMN IF NOT EXISTS "showId" TEXT;

ALTER TABLE "MarketingCampaign"
  ADD COLUMN IF NOT EXISTS "type" "MarketingCampaignType" NOT NULL DEFAULT 'ONE_OFF';

-- 3) Index (idempotent)
CREATE INDEX IF NOT EXISTS "MarketingCampaign_showId_idx"
  ON "MarketingCampaign" ("showId");

-- 4) Foreign key (idempotent)
DO $$
BEGIN
  ALTER TABLE "MarketingCampaign"
    ADD CONSTRAINT "MarketingCampaign_showId_fkey"
    FOREIGN KEY ("showId") REFERENCES "Show"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
