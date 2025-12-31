ALTER TABLE "Promoter"
ADD COLUMN "weeklyReportEmail" TEXT,
ADD COLUMN "weeklyReportTime" TEXT,
ADD COLUMN "weeklyReportDay" TEXT;

ALTER TABLE "ShowPromoter"
ADD COLUMN "weeklyReportDay" TEXT;
