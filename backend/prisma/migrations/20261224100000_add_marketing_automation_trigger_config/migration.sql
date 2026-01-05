-- Add trigger configuration for marketing automations

ALTER TABLE "MarketingAutomation"
  ADD COLUMN IF NOT EXISTS "triggerConfig" JSONB;
