-- AlterTable
ALTER TABLE "Show" ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "companyNumber" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "county" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postcode" TEXT,
ADD COLUMN     "storefrontSlug" TEXT,
ADD COLUMN     "tradingName" TEXT,
ADD COLUMN     "vatNumber" TEXT;

-- CreateTable
CREATE TABLE "ShowSlugHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organiserId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "ShowSlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShowSlugHistory_showId_idx" ON "ShowSlugHistory"("showId");

-- CreateIndex
CREATE UNIQUE INDEX "ShowSlugHistory_organiserId_slug_key" ON "ShowSlugHistory"("organiserId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_storefrontSlug_key" ON "User"("storefrontSlug");

-- AddForeignKey
ALTER TABLE "ShowSlugHistory" ADD CONSTRAINT "ShowSlugHistory_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowSlugHistory" ADD CONSTRAINT "ShowSlugHistory_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

