-- CreateTable
CREATE TABLE "CustomerShowView" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "showId" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "sessionId" TEXT,
    "source" TEXT,

    CONSTRAINT "CustomerShowView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerShowView_showId_idx" ON "CustomerShowView"("showId");

-- CreateIndex
CREATE INDEX "CustomerShowView_customerAccountId_idx" ON "CustomerShowView"("customerAccountId");

-- CreateIndex
CREATE INDEX "CustomerShowView_createdAt_idx" ON "CustomerShowView"("createdAt");

-- AddForeignKey
ALTER TABLE "CustomerShowView" ADD CONSTRAINT "CustomerShowView_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerShowView" ADD CONSTRAINT "CustomerShowView_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
