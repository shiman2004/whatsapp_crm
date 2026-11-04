-- Alpha Health Group CRM — Company & Branch Management
-- Migration: 20261103_company_branch_management.sql
-- Safe, repeatable DDL. Existing branches are preserved and backfilled to RWC.

-- 1. Branch identity, location and operational metadata
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS company VARCHAR(50) DEFAULT 'RWC';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS city VARCHAR(120);
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS district VARCHAR(120);
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS province VARCHAR(120);
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS postal_code VARCHAR(30);
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS manager_id VARCHAR(36);
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS manager_name VARCHAR(255);
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS business_hours JSONB;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS holiday_calendar JSONB;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

UPDATE public.branches SET company = 'RWC' WHERE company IS NULL OR BTRIM(company) = '';
UPDATE public.branches SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END
  WHERE status IS NULL OR BTRIM(status) = '';

-- Branch codes are unique per company, not globally.
ALTER TABLE public.branches DROP CONSTRAINT IF EXISTS branches_code_key;
DROP INDEX IF EXISTS public.branches_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS branches_company_code_key
  ON public.branches(company, code);
CREATE INDEX IF NOT EXISTS branches_company_status_idx
  ON public.branches(company, status);

-- 2. Company profile defaults (legal name is intentionally blank until an administrator records it)
INSERT INTO public.enterprise_system_settings (id, section, scope, scope_id, payload, version, created_at, updated_at)
SELECT
  'settings-company-' || c.code,
  'company',
  'company',
  c.code,
  jsonb_build_object(
    'code', c.code,
    'displayName', c.name,
    'legalName', '',
    'registrationNumber', '',
    'email', '',
    'phone', '',
    'address', '',
    'country', '',
    'logoUrl', '',
    'description', '',
    'status', 'active'
  ),
  1,
  NOW(),
  NOW()
FROM (VALUES
  ('RWC', 'Royal Wellness Center'),
  ('CRAS', 'College of Royal Aesthetic of Sri Lanka'),
  ('AHC', 'Alpha Health Consultancy')
) AS c(code, name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.enterprise_system_settings s
  WHERE s.section = 'company' AND s.scope = 'company' AND s.scope_id = c.code
);

-- 3. Localization & fiscal defaults per company
INSERT INTO public.enterprise_system_settings (id, section, scope, scope_id, payload, version, created_at, updated_at)
SELECT
  'settings-company-localization-' || c.code,
  'company_localization',
  'company',
  c.code,
  jsonb_build_object(
    'currency', 'LKR',
    'timezone', 'Asia/Colombo',
    'dateFormat', 'DD/MM/YYYY',
    'timeFormat', '24h',
    'language', 'en',
    'fiscalYearStart', '01-01',
    'workingWeek', jsonb_build_array(1, 2, 3, 4, 5),
    'holidayCalendarRef', 'LK'
  ),
  1,
  NOW(),
  NOW()
FROM (VALUES ('RWC'), ('CRAS'), ('AHC')) AS c(code)
WHERE NOT EXISTS (
  SELECT 1 FROM public.enterprise_system_settings s
  WHERE s.section = 'company_localization' AND s.scope = 'company' AND s.scope_id = c.code
);
