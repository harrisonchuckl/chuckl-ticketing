-- CreateEnum
CREATE TYPE "CrmSurveyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('RESEND', 'SEATING', 'REFUND', 'PAYMENT', 'VENUE', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MED', 'HIGH');

-- CreateEnum
CREATE TYPE "SupportMessageSenderType" AS ENUM ('CUSTOMER', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "StoreAddOnMode" AS ENUM ('UPSELL', 'TICKET_ADDON', 'BUNDLE');

-- CreateEnum
CREATE TYPE "StoreBundleDiscountType" AS ENUM ('FIXED', 'PCNT');

-- CreateEnum
CREATE TYPE "StoreFulfilmentKind" AS ENUM ('COLLECT', 'POST', 'DIGITAL');

-- CreateTable
CREATE TABLE "CrmSegment" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "definitionJson" JSONB NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmSegmentMember" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmSegmentMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTag" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colour" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmCustomerTag" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmCustomerTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmEventView" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "eventType" "ShowEventType" NOT NULL,
    "customerId" TEXT,
    "customerEmail" TEXT,
    "sessionId" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,

    CONSTRAINT "CrmEventView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmSurvey" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "showId" TEXT,
    "status" "CrmSurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmSurveyQuestion" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "optionsJson" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CrmSurveyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmSurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerEmail" TEXT,
    "sessionId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answersJson" JSONB NOT NULL,

    CONSTRAINT "CrmSurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreTaxRate" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreTaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreFulfilmentMethod" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "StoreFulfilmentKind" NOT NULL,
    "detailsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreFulfilmentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreShowAddOn" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mode" "StoreAddOnMode" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxPerOrder" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StoreShowAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreBundleRule" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "showId" TEXT,
    "productIdsJson" JSONB NOT NULL,
    "discountType" "StoreBundleDiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreBundleRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "customerId" TEXT,
    "orderId" TEXT,
    "showId" TEXT,
    "subject" TEXT NOT NULL,
    "category" "SupportTicketCategory" NOT NULL,
    "status" "SupportTicketStatus" NOT NULL,
    "priority" "SupportTicketPriority" NOT NULL,
    "lastCustomerMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderType" "SupportMessageSenderType" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metaJson" JSONB,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTriageResult" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "suggestedCategory" "SupportTicketCategory" NOT NULL,
    "suggestedPriority" "SupportTicketPriority" NOT NULL,
    "suggestedNextStep" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTriageResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportSuggestedReply" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "draftBody" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportSuggestedReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotKnowledgeSource" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatbotKnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotTranscript" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "customerId" TEXT,
    "showId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "transcriptJson" JSONB NOT NULL,
    "conversionHelped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChatbotTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotEscalationRule" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "matchJson" JSONB NOT NULL,
    "actionJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatbotEscalationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmSegment_organiserId_idx" ON "CrmSegment"("organiserId");

-- CreateIndex
CREATE INDEX "CrmSegmentMember_segmentId_idx" ON "CrmSegmentMember"("segmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmSegmentMember_segmentId_customerEmail_key" ON "CrmSegmentMember"("segmentId", "customerEmail");

-- CreateIndex
CREATE INDEX "CrmTag_organiserId_idx" ON "CrmTag"("organiserId");

-- CreateIndex
CREATE INDEX "CrmCustomerTag_organiserId_idx" ON "CrmCustomerTag"("organiserId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmCustomerTag_customerEmail_tagId_key" ON "CrmCustomerTag"("customerEmail", "tagId");

-- CreateIndex
CREATE INDEX "CrmEventView_organiserId_showId_idx" ON "CrmEventView"("organiserId", "showId");

-- CreateIndex
CREATE INDEX "CrmEventView_eventType_viewedAt_idx" ON "CrmEventView"("eventType", "viewedAt");

-- CreateIndex
CREATE INDEX "CrmSurvey_organiserId_idx" ON "CrmSurvey"("organiserId");

-- CreateIndex
CREATE INDEX "CrmSurveyQuestion_surveyId_idx" ON "CrmSurveyQuestion"("surveyId");

-- CreateIndex
CREATE INDEX "CrmSurveyResponse_surveyId_idx" ON "CrmSurveyResponse"("surveyId");

-- CreateIndex
CREATE INDEX "StoreTaxRate_organiserId_idx" ON "StoreTaxRate"("organiserId");

-- CreateIndex
CREATE INDEX "StoreFulfilmentMethod_organiserId_idx" ON "StoreFulfilmentMethod"("organiserId");

-- CreateIndex
CREATE INDEX "StoreShowAddOn_organiserId_idx" ON "StoreShowAddOn"("organiserId");

-- CreateIndex
CREATE INDEX "StoreShowAddOn_showId_idx" ON "StoreShowAddOn"("showId");

-- CreateIndex
CREATE INDEX "StoreBundleRule_organiserId_idx" ON "StoreBundleRule"("organiserId");

-- CreateIndex
CREATE INDEX "SupportTicket_organiserId_idx" ON "SupportTicket"("organiserId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportMessage_ticketId_idx" ON "SupportMessage"("ticketId");

-- CreateIndex
CREATE INDEX "SupportAttachment_ticketId_idx" ON "SupportAttachment"("ticketId");

-- CreateIndex
CREATE INDEX "SupportTriageResult_ticketId_idx" ON "SupportTriageResult"("ticketId");

-- CreateIndex
CREATE INDEX "SupportSuggestedReply_ticketId_idx" ON "SupportSuggestedReply"("ticketId");

-- CreateIndex
CREATE INDEX "ChatbotKnowledgeSource_organiserId_idx" ON "ChatbotKnowledgeSource"("organiserId");

-- CreateIndex
CREATE INDEX "ChatbotTranscript_organiserId_idx" ON "ChatbotTranscript"("organiserId");

-- CreateIndex
CREATE INDEX "ChatbotEscalationRule_organiserId_idx" ON "ChatbotEscalationRule"("organiserId");

-- AddForeignKey
ALTER TABLE "CrmSegment" ADD CONSTRAINT "CrmSegment_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSegmentMember" ADD CONSTRAINT "CrmSegmentMember_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "CrmSegment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSegmentMember" ADD CONSTRAINT "CrmSegmentMember_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTag" ADD CONSTRAINT "CrmTag_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCustomerTag" ADD CONSTRAINT "CrmCustomerTag_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCustomerTag" ADD CONSTRAINT "CrmCustomerTag_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCustomerTag" ADD CONSTRAINT "CrmCustomerTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CrmTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEventView" ADD CONSTRAINT "CrmEventView_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEventView" ADD CONSTRAINT "CrmEventView_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEventView" ADD CONSTRAINT "CrmEventView_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSurvey" ADD CONSTRAINT "CrmSurvey_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSurvey" ADD CONSTRAINT "CrmSurvey_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSurveyQuestion" ADD CONSTRAINT "CrmSurveyQuestion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "CrmSurvey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSurveyResponse" ADD CONSTRAINT "CrmSurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "CrmSurvey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSurveyResponse" ADD CONSTRAINT "CrmSurveyResponse_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreTaxRate" ADD CONSTRAINT "StoreTaxRate_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreFulfilmentMethod" ADD CONSTRAINT "StoreFulfilmentMethod_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreShowAddOn" ADD CONSTRAINT "StoreShowAddOn_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreShowAddOn" ADD CONSTRAINT "StoreShowAddOn_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreShowAddOn" ADD CONSTRAINT "StoreShowAddOn_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreBundleRule" ADD CONSTRAINT "StoreBundleRule_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreBundleRule" ADD CONSTRAINT "StoreBundleRule_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTriageResult" ADD CONSTRAINT "SupportTriageResult_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportSuggestedReply" ADD CONSTRAINT "SupportSuggestedReply_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotKnowledgeSource" ADD CONSTRAINT "ChatbotKnowledgeSource_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotTranscript" ADD CONSTRAINT "ChatbotTranscript_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotTranscript" ADD CONSTRAINT "ChatbotTranscript_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotTranscript" ADD CONSTRAINT "ChatbotTranscript_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotEscalationRule" ADD CONSTRAINT "ChatbotEscalationRule_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

