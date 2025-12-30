CREATE TABLE IF NOT EXISTS "ProductShowLink" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "productId" TEXT NOT NULL,
  "showId" TEXT NOT NULL,
  "ticketTypeId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "maxPerOrder" INTEGER,
  "maxPerTicket" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ProductShowLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductShowLink_productId_showId_ticketTypeId_key"
  ON "ProductShowLink"("productId", "showId", "ticketTypeId");

CREATE INDEX IF NOT EXISTS "ProductShowLink_showId_isActive_sortOrder_idx"
  ON "ProductShowLink"("showId", "isActive", "sortOrder");

ALTER TABLE "ProductShowLink"
  ADD CONSTRAINT "ProductShowLink_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductShowLink"
  ADD CONSTRAINT "ProductShowLink_showId_fkey"
  FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductShowLink"
  ADD CONSTRAINT "ProductShowLink_ticketTypeId_fkey"
  FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
