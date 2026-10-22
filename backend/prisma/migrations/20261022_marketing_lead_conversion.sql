-- Additive marketing lifecycle and CRM conversion records. Apply locally/staging first.
DO $$ BEGIN CREATE TYPE "MarketingContactStatus" AS ENUM ('new','assigned','follow_up_pending','contacted','interested','not_interested','no_response','converted','do_not_contact'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MarketingConversionStatus" AS ENUM ('pending','approved','linked_existing','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS lifecycle_status "MarketingContactStatus" NOT NULL DEFAULT 'new';
ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS converted_lead_id VARCHAR(50);
ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS qualification_note TEXT;
CREATE INDEX IF NOT EXISTS marketing_contacts_lifecycle_idx ON public.marketing_contacts(company, lifecycle_status, converted_lead_id);

CREATE TABLE IF NOT EXISTS public.marketing_contact_activities (
  id VARCHAR(36) PRIMARY KEY, contact_id VARCHAR(36) NOT NULL REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
  actor_id VARCHAR(36) NOT NULL REFERENCES public.users(id), type VARCHAR(60) NOT NULL, note TEXT, metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS marketing_contact_activities_idx ON public.marketing_contact_activities(contact_id, created_at);

CREATE TABLE IF NOT EXISTS public.marketing_lead_conversions (
  id VARCHAR(36) PRIMARY KEY, contact_id VARCHAR(36) NOT NULL UNIQUE REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
  lead_id VARCHAR(50), company VARCHAR(50) NOT NULL, status "MarketingConversionStatus" NOT NULL DEFAULT 'pending',
  requested_by_id VARCHAR(36) NOT NULL REFERENCES public.users(id), requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by_id VARCHAR(36) REFERENCES public.users(id), reviewed_at TIMESTAMPTZ, rejection_reason TEXT,
  duplicate_lead_id VARCHAR(50), officer_note TEXT, consent_evidence TEXT, source_batch_id VARCHAR(36), campaign_id VARCHAR(36),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS marketing_lead_conversions_review_idx ON public.marketing_lead_conversions(company, status, requested_at);
CREATE INDEX IF NOT EXISTS marketing_lead_conversions_lead_idx ON public.marketing_lead_conversions(lead_id);
