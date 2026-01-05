-- Add missing marketing enum values used by the app.

ALTER TYPE "MarketingCampaignStatus" ADD VALUE IF NOT EXISTS 'APPROVAL_REQUIRED';

ALTER TYPE "MarketingAutomationTriggerType" ADD VALUE IF NOT EXISTS 'SHOW_CREATED';
ALTER TYPE "MarketingAutomationTriggerType" ADD VALUE IF NOT EXISTS 'SHOW_PUBLISHED';
ALTER TYPE "MarketingAutomationTriggerType" ADD VALUE IF NOT EXISTS 'DAYS_BEFORE_SHOW';
ALTER TYPE "MarketingAutomationTriggerType" ADD VALUE IF NOT EXISTS 'VIEWED_NO_PURCHASE';
ALTER TYPE "MarketingAutomationTriggerType" ADD VALUE IF NOT EXISTS 'BIRTHDAY';
ALTER TYPE "MarketingAutomationTriggerType" ADD VALUE IF NOT EXISTS 'ANNIVERSARY';
ALTER TYPE "MarketingAutomationTriggerType" ADD VALUE IF NOT EXISTS 'TAG_APPLIED';
ALTER TYPE "MarketingAutomationTriggerType" ADD VALUE IF NOT EXISTS 'PREFERENCE_TOPIC';
