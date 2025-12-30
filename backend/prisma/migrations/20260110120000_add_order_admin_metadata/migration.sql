DO $$ BEGIN
  CREATE TYPE "OrderEmailStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED', 'UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderAuditAction" AS ENUM ('RESEND_EMAIL', 'NOTE_ADDED', 'TAGS_UPDATED', 'BULK_RESEND_EMAIL', 'BULK_TAGS_UPDATED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "emailDeliveryStatus" "OrderEmailStatus";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "emailDeliveryAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "emailDeliveryError" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "emailPdfAttached" BOOLEAN;

CREATE TABLE IF NOT EXISTS "OrderNote" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "body" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "createdById" TEXT,

  CONSTRAINT "OrderNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderAuditLog" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "action" "OrderAuditAction" NOT NULL,
  "metadata" JSONB,
  "orderId" TEXT NOT NULL,
  "actorId" TEXT,

  CONSTRAINT "OrderAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderNote_orderId_idx" ON "OrderNote"("orderId");
CREATE INDEX IF NOT EXISTS "OrderNote_createdAt_idx" ON "OrderNote"("createdAt");

CREATE INDEX IF NOT EXISTS "OrderAuditLog_orderId_idx" ON "OrderAuditLog"("orderId");
CREATE INDEX IF NOT EXISTS "OrderAuditLog_createdAt_idx" ON "OrderAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "OrderAuditLog_actorId_idx" ON "OrderAuditLog"("actorId");

ALTER TABLE "OrderNote"
  ADD CONSTRAINT "OrderNote_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderNote"
  ADD CONSTRAINT "OrderNote_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderAuditLog"
  ADD CONSTRAINT "OrderAuditLog_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderAuditLog"
  ADD CONSTRAINT "OrderAuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");
CREATE INDEX IF NOT EXISTS "Order_showId_idx" ON "Order"("showId");
CREATE INDEX IF NOT EXISTS "Order_ticketTypeId_idx" ON "Order"("ticketTypeId");
CREATE INDEX IF NOT EXISTS "Order_email_idx" ON "Order"("email");
CREATE INDEX IF NOT EXISTS "Order_stripeId_idx" ON "Order"("stripeId");
CREATE INDEX IF NOT EXISTS "Order_stripeCheckoutSessionId_idx" ON "Order"("stripeCheckoutSessionId");
CREATE INDEX IF NOT EXISTS "Order_emailDeliveryStatus_idx" ON "Order"("emailDeliveryStatus");

CREATE INDEX IF NOT EXISTS "Show_venueId_idx" ON "Show"("venueId");
CREATE INDEX IF NOT EXISTS "Show_organiserId_idx" ON "Show"("organiserId");
CREATE INDEX IF NOT EXISTS "Show_date_idx" ON "Show"("date");
