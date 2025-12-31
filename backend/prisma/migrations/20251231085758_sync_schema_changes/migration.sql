-- DropForeignKey
ALTER TABLE "ShowPromoter" DROP CONSTRAINT "ShowPromoter_promoterId_fkey";

-- DropForeignKey
ALTER TABLE "ShowPromoter" DROP CONSTRAINT "ShowPromoter_showId_fkey";

-- AddForeignKey
ALTER TABLE "ShowPromoter" ADD CONSTRAINT "ShowPromoter_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowPromoter" ADD CONSTRAINT "ShowPromoter_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

