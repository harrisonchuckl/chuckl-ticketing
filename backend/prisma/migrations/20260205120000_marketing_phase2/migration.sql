-- CreateEnum
CREATE TYPE "MarketingAutomationTriggerType" AS ENUM ('AFTER_PURCHASE', 'NO_PURCHASE_DAYS', 'VIP_THRESHOLD', 'SHOW_CATEGORY_INTEREST', 'ABANDONED_CHECKOUT');

-- CreateEnum
CREATE TYPE "MarketingAutomationStateStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'STOPPED');

-- CreateEnum
CREATE TYPE "MarketingAutomationStepStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MarketingPreferenceStatus" AS ENUM ('SUBSCRIBED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "MarketingCheckoutStatus" AS ENUM ('STARTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "MarketingAutomation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" "MarketingAutomationTriggerType" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationStep" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "delayMinutes" INTEGER NOT NULL,
    "templateId" TEXT NOT NULL,
    "conditionRules" JSONB NOT NULL,
    "stepOrder" INTEGER NOT NULL,

    CONSTRAINT "MarketingAutomationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "status" "MarketingAutomationStateStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAutomationState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationStepExecution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "MarketingAutomationStepStatus" NOT NULL DEFAULT 'SENT',
    "errorText" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingAutomationStepExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingPreferenceTopic" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingPreferenceTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingContactPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "status" "MarketingPreferenceStatus" NOT NULL DEFAULT 'SUBSCRIBED',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingContactPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCheckoutEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "showId" TEXT,
    "email" TEXT,
    "status" "MarketingCheckoutStatus" NOT NULL DEFAULT 'STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCheckoutEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingAutomation_tenantId_idx" ON "MarketingAutomation"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAutomationStep_tenantId_automationId_stepOrder_key" ON "MarketingAutomationStep"("tenantId", "automationId", "stepOrder");

-- CreateIndex
CREATE INDEX "MarketingAutomationStep_tenantId_idx" ON "MarketingAutomationStep"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAutomationState_tenantId_contactId_automationId_key" ON "MarketingAutomationState"("tenantId", "contactId", "automationId");

-- CreateIndex
CREATE INDEX "MarketingAutomationState_tenantId_nextRunAt_idx" ON "MarketingAutomationState"("tenantId", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAutomationStepExecution_tenantId_contactId_stepId_key" ON "MarketingAutomationStepExecution"("tenantId", "contactId", "stepId");

-- CreateIndex
CREATE INDEX "MarketingAutomationStepExecution_tenantId_idx" ON "MarketingAutomationStepExecution"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingPreferenceTopic_tenantId_name_key" ON "MarketingPreferenceTopic"("tenantId", "name");

-- CreateIndex
CREATE INDEX "MarketingPreferenceTopic_tenantId_idx" ON "MarketingPreferenceTopic"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingContactPreference_tenantId_contactId_topicId_key" ON "MarketingContactPreference"("tenantId", "contactId", "topicId");

-- CreateIndex
CREATE INDEX "MarketingContactPreference_tenantId_idx" ON "MarketingContactPreference"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCheckoutEvent_tenantId_orderId_key" ON "MarketingCheckoutEvent"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "MarketingCheckoutEvent_tenantId_status_idx" ON "MarketingCheckoutEvent"("tenantId", "status");

-- CreateIndex
CREATE INDEX "MarketingAuditLog_tenantId_createdAt_idx" ON "MarketingAuditLog"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketingAutomation" ADD CONSTRAINT "MarketingAutomation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationStep" ADD CONSTRAINT "MarketingAutomationStep_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "MarketingAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationStep" ADD CONSTRAINT "MarketingAutomationStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationState" ADD CONSTRAINT "MarketingAutomationState_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "MarketingAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationState" ADD CONSTRAINT "MarketingAutomationState_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "MarketingContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationStepExecution" ADD CONSTRAINT "MarketingAutomationStepExecution_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "MarketingAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationStepExecution" ADD CONSTRAINT "MarketingAutomationStepExecution_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "MarketingAutomationStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationStepExecution" ADD CONSTRAINT "MarketingAutomationStepExecution_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "MarketingContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingPreferenceTopic" ADD CONSTRAINT "MarketingPreferenceTopic_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingContactPreference" ADD CONSTRAINT "MarketingContactPreference_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "MarketingContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingContactPreference" ADD CONSTRAINT "MarketingContactPreference_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "MarketingPreferenceTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCheckoutEvent" ADD CONSTRAINT "MarketingCheckoutEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAuditLog" ADD CONSTRAINT "MarketingAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
