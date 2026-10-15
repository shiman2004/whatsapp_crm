-- Migration: 20261015_real_whatsapp_blue_ticks.sql
-- Description: Add delivery and read receipt timestamps with indexes for real WhatsApp blue tick tracking

-- 1. Add timestamps to messages table (safe, idempotent)
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP WITH TIME ZONE;

-- 2. Add timestamps to message_audits table (safe, idempotent)
ALTER TABLE "message_audits" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "message_audits" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP WITH TIME ZONE;

-- 3. Add high-performance indexes for status tracking and receipts
CREATE INDEX IF NOT EXISTS "idx_messages_status" ON "messages"("status");
CREATE INDEX IF NOT EXISTS "idx_messages_direction_status" ON "messages"("direction", "status");
CREATE INDEX IF NOT EXISTS "idx_message_audits_message_id" ON "message_audits"("message_id");
CREATE INDEX IF NOT EXISTS "idx_message_audits_delivery_status" ON "message_audits"("delivery_status");
