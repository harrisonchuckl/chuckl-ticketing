-- 1) Add seatRef (safe if already added)
ALTER TABLE "Ticket"
ADD COLUMN IF NOT EXISTS "seatRef" TEXT;

-- 2) Drop the foreign key from Ticket.seatId -> Seat.id
-- First, drop the known default constraint name if present
ALTER TABLE "Ticket"
DROP CONSTRAINT IF EXISTS "Ticket_seatId_fkey";

