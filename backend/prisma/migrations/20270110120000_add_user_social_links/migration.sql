-- Add social links JSON storage to users
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "socialLinks" JSONB;
