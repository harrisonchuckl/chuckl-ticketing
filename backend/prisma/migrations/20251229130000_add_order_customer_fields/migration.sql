-- Add customer fields captured from Stripe Checkout
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "buyerFirstName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "buyerLastName"  TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "buyerPostcode"  TEXT;

