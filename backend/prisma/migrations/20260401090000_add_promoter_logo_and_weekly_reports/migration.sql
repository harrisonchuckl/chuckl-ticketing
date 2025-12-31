ALTER TABLE "Promoter" ADD COLUMN "logoUrl" TEXT;

ALTER TABLE "ShowPromoter"
ADD COLUMN "weeklyReportEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "weeklyReportEmail" TEXT,
ADD COLUMN "weeklyReportTime" TEXT;
