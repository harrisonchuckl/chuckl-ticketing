CREATE TABLE "ShowPromoter" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "showId" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,

    CONSTRAINT "ShowPromoter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShowPromoter_showId_promoterId_key" ON "ShowPromoter"("showId", "promoterId");
CREATE INDEX "ShowPromoter_showId_idx" ON "ShowPromoter"("showId");
CREATE INDEX "ShowPromoter_promoterId_idx" ON "ShowPromoter"("promoterId");

ALTER TABLE "ShowPromoter" ADD CONSTRAINT "ShowPromoter_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShowPromoter" ADD CONSTRAINT "ShowPromoter_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
