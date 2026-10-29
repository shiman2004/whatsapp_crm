-- Security & Access: persisted role and user permission profiles.
--
-- One row per subject. `overrides` holds only capability effects; the capability
-- catalogue, immutable boundaries and scope limits live in src/securityPolicy.js
-- and are re-validated on every write. `revision` provides optimistic concurrency.

CREATE TABLE IF NOT EXISTS public.security_permission_profiles (
  subject_type VARCHAR(10) NOT NULL,
  subject_id VARCHAR(100) NOT NULL,
  overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  scope VARCHAR(20),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_by VARCHAR(100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (subject_type, subject_id),
  CONSTRAINT security_permission_profiles_subject_type_check
    CHECK (subject_type IN ('role', 'user')),
  CONSTRAINT security_permission_profiles_scope_check
    CHECK (scope IS NULL OR scope IN ('own', 'assigned', 'department', 'all'))
);

CREATE INDEX IF NOT EXISTS idx_security_profiles_subject
  ON public.security_permission_profiles(subject_type, updated_at DESC);
