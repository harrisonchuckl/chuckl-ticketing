-- Drop legacy unique index that conflicts with triggerKey uniqueness
-- Safe to run even if already removed.
DROP INDEX IF EXISTS "MarketingAutomationState_tenantId_contactId_automationId_key";
