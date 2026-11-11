-- ============================================================================
-- Migration: 20261110_dynamic_lead_stages.sql
-- Purpose  : Safely migrate leads.stage and lead_stage_histories.(fromStage,
--            toStage) from static Postgres enum "LeadStage" to VARCHAR(100)
--            so custom pipeline stages created in Settings persist via Prisma.
-- Safety   : Non-destructive, idempotent, preserves all existing rows/values.
--            Does NOT drop type "LeadStage" so rollback stays lossless.
-- ============================================================================

-- 1. Preflight check: verify no NULL values violate constraints
DO $$
DECLARE
  null_leads_count INT;
BEGIN
  SELECT COUNT(*) INTO null_leads_count FROM "public"."leads" WHERE "stage" IS NULL;
  IF null_leads_count > 0 THEN
    RAISE EXCEPTION 'Preflight failed: found % lead rows with NULL stage', null_leads_count;
  END IF;
END $$;

-- 2. Convert columns only if still bound to enum "LeadStage"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'stage'
      AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE "public"."leads" ALTER COLUMN "stage" DROP DEFAULT;
    ALTER TABLE "public"."leads" ALTER COLUMN "stage" TYPE VARCHAR(100) USING "stage"::text;
    ALTER TABLE "public"."leads" ALTER COLUMN "stage" SET DEFAULT 'new';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lead_stage_histories'
      AND column_name = 'fromStage'
      AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE "public"."lead_stage_histories"
      ALTER COLUMN "fromStage" TYPE VARCHAR(100) USING "fromStage"::text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lead_stage_histories'
      AND column_name = 'toStage'
      AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE "public"."lead_stage_histories"
      ALTER COLUMN "toStage" TYPE VARCHAR(100) USING "toStage"::text;
  END IF;
END $$;

-- 3. Ensure stage index remains intact
CREATE INDEX IF NOT EXISTS "leads_stage_idx" ON "public"."leads"("stage");

-- ============================================================================
-- ROLLBACK PROCEDURE (only if reverting to static enum schema):
--   1. Ensure any custom stage keys exist in enum "LeadStage" or remap them:
--      ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS '<custom_key>';
--   2. Revert column types:
--      ALTER TABLE "public"."leads" ALTER COLUMN "stage" DROP DEFAULT;
--      ALTER TABLE "public"."leads" ALTER COLUMN "stage" TYPE "LeadStage" USING "stage"::"LeadStage";
--      ALTER TABLE "public"."leads" ALTER COLUMN "stage" SET DEFAULT 'new'::"LeadStage";
--      ALTER TABLE "public"."lead_stage_histories" ALTER COLUMN "fromStage" TYPE "LeadStage" USING "fromStage"::"LeadStage";
--      ALTER TABLE "public"."lead_stage_histories" ALTER COLUMN "toStage" TYPE "LeadStage" USING "toStage"::"LeadStage";
-- ============================================================================
