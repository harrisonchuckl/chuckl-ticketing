-- Add new automation trigger types for preset scheduling
ALTER TYPE "MarketingAutomationTriggerType" ADD VALUE IF NOT EXISTS 'MONTHLY_ROUNDUP';
ALTER TYPE "MarketingAutomationTriggerType" ADD VALUE IF NOT EXISTS 'LOW_SALES_VELOCITY';
