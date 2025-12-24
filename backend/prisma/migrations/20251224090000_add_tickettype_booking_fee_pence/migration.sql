-- Add optional per-ticket booking fee in pence
ALTER TABLE "TicketType"
  ADD COLUMN IF NOT EXISTS "bookingFeePence" integer;
