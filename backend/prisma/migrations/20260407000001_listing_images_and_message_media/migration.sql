-- Add image and video values to MessageType enum
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'image';
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'video';

-- Add media columns to messages
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "media_url" TEXT,
  ADD COLUMN IF NOT EXISTS "media_key" TEXT;

-- Add ai_attributes to proof_assets
ALTER TABLE "proof_assets"
  ADD COLUMN IF NOT EXISTS "ai_attributes" JSONB;
