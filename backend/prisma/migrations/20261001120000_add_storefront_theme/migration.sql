-- CreateEnum
CREATE TYPE "StorefrontThemePage" AS ENUM ('ALL_EVENTS', 'EVENT_PAGE');

-- CreateTable
CREATE TABLE "StorefrontTheme" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organiserId" TEXT NOT NULL,
    "page" "StorefrontThemePage" NOT NULL,
    "draftJson" JSONB,
    "publishedJson" JSONB,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "StorefrontTheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorefrontTheme_organiserId_idx" ON "StorefrontTheme"("organiserId");

-- CreateIndex
CREATE UNIQUE INDEX "StorefrontTheme_organiserId_page_key" ON "StorefrontTheme"("organiserId", "page");

-- AddForeignKey
ALTER TABLE "StorefrontTheme" ADD CONSTRAINT "StorefrontTheme_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
