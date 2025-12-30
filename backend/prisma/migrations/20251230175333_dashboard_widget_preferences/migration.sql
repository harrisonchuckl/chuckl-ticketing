-- DropForeignKey
ALTER TABLE "MarketingAuditLog" DROP CONSTRAINT "MarketingAuditLog_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingAutomation" DROP CONSTRAINT "MarketingAutomation_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingAutomationState" DROP CONSTRAINT "MarketingAutomationState_automationId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingAutomationState" DROP CONSTRAINT "MarketingAutomationState_contactId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingAutomationStep" DROP CONSTRAINT "MarketingAutomationStep_automationId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingAutomationStepExecution" DROP CONSTRAINT "MarketingAutomationStepExecution_automationId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingAutomationStepExecution" DROP CONSTRAINT "MarketingAutomationStepExecution_contactId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingAutomationStepExecution" DROP CONSTRAINT "MarketingAutomationStepExecution_stepId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingCampaign" DROP CONSTRAINT "MarketingCampaign_segmentId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingCampaign" DROP CONSTRAINT "MarketingCampaign_templateId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingCampaign" DROP CONSTRAINT "MarketingCampaign_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingCampaignRecipient" DROP CONSTRAINT "MarketingCampaignRecipient_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingCampaignRecipient" DROP CONSTRAINT "MarketingCampaignRecipient_contactId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingCheckoutEvent" DROP CONSTRAINT "MarketingCheckoutEvent_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingConsent" DROP CONSTRAINT "MarketingConsent_contactId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingContact" DROP CONSTRAINT "MarketingContact_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingContactPreference" DROP CONSTRAINT "MarketingContactPreference_contactId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingContactPreference" DROP CONSTRAINT "MarketingContactPreference_topicId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingContactTag" DROP CONSTRAINT "MarketingContactTag_contactId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingContactTag" DROP CONSTRAINT "MarketingContactTag_tagId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingEmailEvent" DROP CONSTRAINT "MarketingEmailEvent_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingPreferenceTopic" DROP CONSTRAINT "MarketingPreferenceTopic_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingSegment" DROP CONSTRAINT "MarketingSegment_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingTag" DROP CONSTRAINT "MarketingTag_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingTemplate" DROP CONSTRAINT "MarketingTemplate_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "OrderAuditLog" DROP CONSTRAINT "OrderAuditLog_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderNote" DROP CONSTRAINT "OrderNote_orderId_fkey";

-- DropForeignKey
ALTER TABLE "PromoterActivity" DROP CONSTRAINT "PromoterActivity_promoterId_fkey";

-- DropForeignKey
ALTER TABLE "PromoterContact" DROP CONSTRAINT "PromoterContact_promoterId_fkey";

-- DropForeignKey
ALTER TABLE "PromoterDocument" DROP CONSTRAINT "PromoterDocument_promoterId_fkey";

-- AddForeignKey
ALTER TABLE "PromoterContact" ADD CONSTRAINT "PromoterContact_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterDocument" ADD CONSTRAINT "PromoterDocument_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterActivity" ADD CONSTRAINT "PromoterActivity_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingContact" ADD CONSTRAINT "MarketingContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingConsent" ADD CONSTRAINT "MarketingConsent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "MarketingContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSuppression" ADD CONSTRAINT "MarketingSuppression_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingTag" ADD CONSTRAINT "MarketingTag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingContactTag" ADD CONSTRAINT "MarketingContactTag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "MarketingContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingContactTag" ADD CONSTRAINT "MarketingContactTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "MarketingTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingTemplate" ADD CONSTRAINT "MarketingTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSegment" ADD CONSTRAINT "MarketingSegment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "MarketingSegment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaignRecipient" ADD CONSTRAINT "MarketingCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaignRecipient" ADD CONSTRAINT "MarketingCampaignRecipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "MarketingContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingEmailEvent" ADD CONSTRAINT "MarketingEmailEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomation" ADD CONSTRAINT "MarketingAutomation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationStep" ADD CONSTRAINT "MarketingAutomationStep_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "MarketingAutomation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationState" ADD CONSTRAINT "MarketingAutomationState_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "MarketingAutomation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationState" ADD CONSTRAINT "MarketingAutomationState_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "MarketingContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationStepExecution" ADD CONSTRAINT "MarketingAutomationStepExecution_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "MarketingAutomation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationStepExecution" ADD CONSTRAINT "MarketingAutomationStepExecution_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "MarketingAutomationStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationStepExecution" ADD CONSTRAINT "MarketingAutomationStepExecution_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "MarketingContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingPreferenceTopic" ADD CONSTRAINT "MarketingPreferenceTopic_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingContactPreference" ADD CONSTRAINT "MarketingContactPreference_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "MarketingContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingContactPreference" ADD CONSTRAINT "MarketingContactPreference_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "MarketingPreferenceTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCheckoutEvent" ADD CONSTRAINT "MarketingCheckoutEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAuditLog" ADD CONSTRAINT "MarketingAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderNote" ADD CONSTRAINT "OrderNote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAuditLog" ADD CONSTRAINT "OrderAuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

