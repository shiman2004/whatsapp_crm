-- Patient Assessment & Reports module.
-- The runtime bootstrap also contains this idempotent DDL for legacy installs.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'clinical_nurse';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'clinical_doctor';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'report_analyst';

CREATE TABLE IF NOT EXISTS public.clinical_ops_records (
  kind VARCHAR(80) NOT NULL,
  id VARCHAR(100) NOT NULL,
  data JSONB NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(kind, id)
);

CREATE INDEX IF NOT EXISTS idx_clinical_ops_kind_updated
  ON public.clinical_ops_records(kind, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_ops_status
  ON public.clinical_ops_records(kind, (data->>'status'));
CREATE INDEX IF NOT EXISTS idx_clinical_ops_doctor
  ON public.clinical_ops_records(kind, (data->>'assignedDoctorId'));

CREATE TABLE IF NOT EXISTS public.clinical_ops_audit (
  id BIGSERIAL PRIMARY KEY,
  actor_id VARCHAR(100),
  action VARCHAR(120) NOT NULL,
  target VARCHAR(120) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_ops_audit_created
  ON public.clinical_ops_audit(created_at DESC);
