-- Persist the moment a lead is accepted in the pipeline.
ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);
