-- CreateTable
CREATE TABLE "MarketingAiSuggestion" (
    "id" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "showId" TEXT,
    "suggestionType" TEXT NOT NULL,
    "suggestionPayload" JSONB NOT NULL,
    "sourceData" JSONB,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingAiSuggestion_organiserId_idx" ON "MarketingAiSuggestion"("organiserId");

-- CreateIndex
CREATE INDEX "MarketingAiSuggestion_showId_idx" ON "MarketingAiSuggestion"("showId");

-- AddForeignKey
ALTER TABLE "MarketingAiSuggestion" ADD CONSTRAINT "MarketingAiSuggestion_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAiSuggestion" ADD CONSTRAINT "MarketingAiSuggestion_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;
