-- Public Contact Marketing foundation (additive only; do not run through runtime bootstrap).
-- Apply to staging first, then use the reviewed deployment migration procedure.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'marketing_officer';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'marketing_admin';

DO $$ BEGIN CREATE TYPE "MarketingConsentStatus" AS ENUM ('unknown', 'verified', 'denied', 'opted_out'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MarketingImportStatus" AS ENUM ('queued', 'processing', 'completed', 'partially_completed', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MarketingRowStatus" AS ENUM ('pending', 'saved', 'duplicate', 'invalid', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MarketingTaskStatus" AS ENUM ('pending', 'contacted', 'interested', 'not_interested', 'follow_up', 'completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MarketingCampaignApprovalStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.marketing_contacts (
  id VARCHAR(36) PRIMARY KEY, serial_number VARCHAR(50) NOT NULL UNIQUE,
  normalized_phone VARCHAR(32) NOT NULL UNIQUE, company VARCHAR(50) NOT NULL,
  original_source VARCHAR(100) NOT NULL, source_group_name VARCHAR(255),
  first_added_by_id VARCHAR(36) NOT NULL REFERENCES public.users(id),
  first_added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consent_status "MarketingConsentStatus" NOT NULL DEFAULT 'unknown',
  current_owner_id VARCHAR(36) REFERENCES public.users(id),
  assigned_by_id VARCHAR(36) REFERENCES public.users(id), assigned_at TIMESTAMPTZ,
  last_updated_by_id VARCHAR(36) REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS marketing_contacts_scope_idx ON public.marketing_contacts(company, consent_status, current_owner_id);
CREATE INDEX IF NOT EXISTS marketing_contacts_owner_idx ON public.marketing_contacts(current_owner_id, assigned_at);

CREATE TABLE IF NOT EXISTS public.marketing_import_batches (
  id VARCHAR(36) PRIMARY KEY, batch_number VARCHAR(50) NOT NULL UNIQUE, company VARCHAR(50) NOT NULL,
  uploaded_by_id VARCHAR(36) NOT NULL REFERENCES public.users(id), source VARCHAR(100) NOT NULL,
  source_group_name VARCHAR(255), file_name VARCHAR(255), file_storage_key TEXT,
  idempotency_key VARCHAR(100) NOT NULL UNIQUE, total_submitted INT NOT NULL DEFAULT 0,
  valid_new_count INT NOT NULL DEFAULT 0, duplicate_count INT NOT NULL DEFAULT 0,
  invalid_count INT NOT NULL DEFAULT 0, saved_count INT NOT NULL DEFAULT 0, failed_count INT NOT NULL DEFAULT 0,
  status "MarketingImportStatus" NOT NULL DEFAULT 'queued', started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  error_summary TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS marketing_import_batches_owner_idx ON public.marketing_import_batches(company, uploaded_by_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketing_import_rows (
  id VARCHAR(36) PRIMARY KEY, batch_id VARCHAR(36) NOT NULL REFERENCES public.marketing_import_batches(id) ON DELETE CASCADE,
  row_number INT NOT NULL, raw_phone VARCHAR(255), normalized_phone VARCHAR(32),
  status "MarketingRowStatus" NOT NULL DEFAULT 'pending', contact_id VARCHAR(36) REFERENCES public.marketing_contacts(id),
  error_code VARCHAR(100), error_message TEXT, processed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id, row_number)
);
CREATE INDEX IF NOT EXISTS marketing_import_rows_status_idx ON public.marketing_import_rows(batch_id, status);

CREATE TABLE IF NOT EXISTS public.marketing_contact_contributions (
  id VARCHAR(36) PRIMARY KEY, contact_id VARCHAR(36) REFERENCES public.marketing_contacts(id),
  batch_id VARCHAR(36) REFERENCES public.marketing_import_batches(id), import_row_id VARCHAR(36) REFERENCES public.marketing_import_rows(id),
  contributed_by_id VARCHAR(36) NOT NULL REFERENCES public.users(id), company VARCHAR(50) NOT NULL,
  source VARCHAR(100) NOT NULL, source_group_name VARCHAR(255), outcome VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.marketing_consent_events (
  id VARCHAR(36) PRIMARY KEY, contact_id VARCHAR(36) NOT NULL REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
  status "MarketingConsentStatus" NOT NULL, purpose VARCHAR(255), channel VARCHAR(100), evidence TEXT,
  recorded_by_id VARCHAR(36) NOT NULL REFERENCES public.users(id), recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.marketing_suppressions (
  id VARCHAR(36) PRIMARY KEY, contact_id VARCHAR(36) NOT NULL UNIQUE REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
  reason VARCHAR(255) NOT NULL, recorded_by_id VARCHAR(36) NOT NULL REFERENCES public.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.marketing_assignment_history (
  id VARCHAR(36) PRIMARY KEY, contact_id VARCHAR(36) NOT NULL REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
  previous_owner_id VARCHAR(36) REFERENCES public.users(id), new_owner_id VARCHAR(36) REFERENCES public.users(id),
  assigned_by_id VARCHAR(36) NOT NULL REFERENCES public.users(id), reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.marketing_tasks (
  id VARCHAR(36) PRIMARY KEY, contact_id VARCHAR(36) NOT NULL REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
  owner_id VARCHAR(36) NOT NULL REFERENCES public.users(id), status "MarketingTaskStatus" NOT NULL DEFAULT 'pending',
  notes TEXT, follow_up_at TIMESTAMPTZ, closed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact_id, owner_id)
);
CREATE TABLE IF NOT EXISTS public.marketing_notifications (
  id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL REFERENCES public.users(id), type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.marketing_audit_logs (
  id VARCHAR(36) PRIMARY KEY, company VARCHAR(50) NOT NULL, actor_id VARCHAR(36) REFERENCES public.users(id),
  action VARCHAR(100) NOT NULL, entity_type VARCHAR(100) NOT NULL, entity_id VARCHAR(36) NOT NULL,
  correlation_id VARCHAR(100), metadata JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.marketing_import_jobs (
  id VARCHAR(36) PRIMARY KEY, batch_id VARCHAR(36) NOT NULL UNIQUE REFERENCES public.marketing_import_batches(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'queued', attempts INT NOT NULL DEFAULT 0, lease_owner VARCHAR(100),
  lease_until TIMESTAMPTZ, last_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS marketing_import_jobs_claim_idx ON public.marketing_import_jobs(status, lease_until, created_at);

CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id VARCHAR(36) PRIMARY KEY, company VARCHAR(50) NOT NULL, title VARCHAR(255) NOT NULL, description TEXT,
  target_audience TEXT, instructions TEXT, approved_text TEXT, start_date TIMESTAMPTZ, end_date TIMESTAMPTZ,
  status "MarketingCampaignApprovalStatus" NOT NULL DEFAULT 'draft', created_by_id VARCHAR(36) NOT NULL REFERENCES public.users(id),
  approved_by_id VARCHAR(36) REFERENCES public.users(id), approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.marketing_campaign_assets (
  id VARCHAR(36) PRIMARY KEY, campaign_id VARCHAR(36) NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL, file_name VARCHAR(255) NOT NULL, mime_type VARCHAR(100) NOT NULL, size_bytes INT NOT NULL,
  uploaded_by_id VARCHAR(36) NOT NULL REFERENCES public.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.marketing_campaign_officers (
  campaign_id VARCHAR(36) NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL REFERENCES public.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, user_id)
);

-- Dedicated immutable marketing serial allocator. It is intentionally independent of lead serials.
CREATE TABLE IF NOT EXISTS public.marketing_contact_serials (id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1), next_value BIGINT NOT NULL DEFAULT 1);
INSERT INTO public.marketing_contact_serials (id, next_value) VALUES (1, 1) ON CONFLICT (id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.next_marketing_contact_serial() RETURNS VARCHAR LANGUAGE plpgsql AS $$
DECLARE allocated_value BIGINT;
BEGIN
  UPDATE public.marketing_contact_serials SET next_value = next_value + 1 WHERE id = 1 RETURNING next_value - 1 INTO allocated_value;
  RETURN 'MKT-' || LPAD(allocated_value::TEXT, 8, '0');
END;
$$;
