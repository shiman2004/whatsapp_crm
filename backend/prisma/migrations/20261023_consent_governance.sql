-- Consent Governance & Protection Gate (additive; preserve legacy 'denied' enum value)
-- Additive columns/mappings, backfill, indexes, and data migration for legacy denied.

-- Add columns to marketing_consent_events if missing
ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);
ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS evidence_type VARCHAR(50);
ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS evidence_reference VARCHAR(255);
ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

-- Ensure indexes
CREATE INDEX IF NOT EXISTS marketing_consent_events_contact_occurred_idx ON public.marketing_consent_events(contact_id, recorded_at);
CREATE INDEX IF NOT EXISTS marketing_consent_events_company_occurred_idx ON public.marketing_consent_events(company_id, recorded_at);
CREATE INDEX IF NOT EXISTS marketing_consent_events_decision_occurred_idx ON public.marketing_consent_events(status, recorded_at);

-- Backfill company_id on consent events
UPDATE public.marketing_consent_events e
SET company_id = c.company
FROM public.marketing_contacts c
WHERE e.contact_id = c.id AND e.company_id IS NULL;

-- Add Lead.marketing_contact_id
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS marketing_contact_id VARCHAR(36);
CREATE UNIQUE INDEX IF NOT EXISTS leads_marketing_contact_id_key ON public.leads(marketing_contact_id);
CREATE INDEX IF NOT EXISTS leads_marketing_contact_id_idx ON public.leads(marketing_contact_id);

-- Migrate legacy 'denied' to opted_out with audit trail and suppression
DO $$
DECLARE
  r RECORD;
  ev_id VARCHAR(36);
  sup_id VARCHAR(36);
BEGIN
  FOR r IN
    SELECT c.id AS contact_id, c.company, COALESCE(c.last_updated_by_id, c.first_added_by_id, 'SYSTEM') AS actor_id
    FROM public.marketing_contacts c
    WHERE c.consent_status = 'denied'
  LOOP
    -- Create opted_out consent event if none exists for this contact as opted_out recently? ensure we don't duplicate if already migrated
    IF NOT EXISTS (
      SELECT 1 FROM public.marketing_consent_events e
      WHERE e.contact_id = r.contact_id AND e.status = 'opted_out'
    ) THEN
      ev_id := gen_random_uuid()::text;
      INSERT INTO public.marketing_consent_events (id, contact_id, company_id, status, purpose, channel, evidence, recorded_by_id, recorded_at, created_at)
      VALUES (ev_id, r.contact_id, r.company, 'opted_out', 'Marketing outreach & consultation follow-up', 'OTHER', 'Migrated legacy denied to opted_out with suppression', r.actor_id, NOW(), NOW());
    END IF;

    -- Ensure suppression exists
    IF NOT EXISTS (SELECT 1 FROM public.marketing_suppressions s WHERE s.contact_id = r.contact_id) THEN
      sup_id := gen_random_uuid()::text;
      INSERT INTO public.marketing_suppressions (id, contact_id, reason, recorded_by_id, created_at)
      VALUES (sup_id, r.contact_id, 'Migrated legacy denied to opted_out', r.actor_id, NOW());
    END IF;

    -- Update contact
    UPDATE public.marketing_contacts
    SET consent_status = 'opted_out', lifecycle_status = 'do_not_contact', last_updated_by_id = COALESCE(last_updated_by_id, r.actor_id), last_activity_at = COALESCE(last_activity_at, NOW()), updated_at = NOW()
    WHERE id = r.contact_id;
  END LOOP;
END $$;
