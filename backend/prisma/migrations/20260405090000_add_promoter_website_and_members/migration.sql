DROP INDEX IF EXISTS "Promoter_name_key";

ALTER TABLE "Promoter" ADD COLUMN "website" TEXT;
ALTER TABLE "Promoter" ADD COLUMN "websiteDomain" TEXT;

CREATE UNIQUE INDEX "Promoter_websiteDomain_key" ON "Promoter"("websiteDomain");

CREATE TABLE "PromoterMember" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promoterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PromoterMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromoterMember_promoterId_userId_key" ON "PromoterMember"("promoterId", "userId");
CREATE INDEX "PromoterMember_promoterId_idx" ON "PromoterMember"("promoterId");
CREATE INDEX "PromoterMember_userId_idx" ON "PromoterMember"("userId");

ALTER TABLE "PromoterMember" ADD CONSTRAINT "PromoterMember_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromoterMember" ADD CONSTRAINT "PromoterMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
