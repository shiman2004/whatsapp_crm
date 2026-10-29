-- User Management & Security expansion (expand-only, no data mutation).
-- Every statement is idempotent so it can be applied to an existing database
-- without dropping, truncating or rewriting rows.

-- 1. Extend the single existing users identity table (no duplicate identities).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department_id VARCHAR(36);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS manager_id VARCHAR(36);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS users_employee_id_key
  ON public.users(employee_id) WHERE employee_id IS NOT NULL;

-- 2. Departments and teams.
CREATE TABLE IF NOT EXISTS public.departments (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  company VARCHAR(50),
  branch VARCHAR(100),
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS departments_company_idx ON public.departments(company, branch);

CREATE TABLE IF NOT EXISTS public.teams (
  id VARCHAR(36) PRIMARY KEY,
  department_id VARCHAR(36),
  name VARCHAR(120) NOT NULL,
  company VARCHAR(50),
  branch VARCHAR(100),
  lead_user_id VARCHAR(36),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS teams_department_idx ON public.teams(department_id);

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

-- 3. Invitations store only a hash of the one-time activation token.
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  company VARCHAR(50),
  branch VARCHAR(100),
  department_id VARCHAR(36),
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  invited_by VARCHAR(36),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_invitations_email_idx ON public.user_invitations(LOWER(email));
CREATE INDEX IF NOT EXISTS user_invitations_pending_idx ON public.user_invitations(expires_at)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- 4. Server-side session records so revocation is real, not cosmetic.
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 0,
  ip VARCHAR(100),
  user_agent VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by VARCHAR(36),
  revoke_reason VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON public.user_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_sessions_active_idx ON public.user_sessions(user_id)
  WHERE revoked_at IS NULL;

-- 5. Foreign keys (added only when the constraint is missing).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_department_id_fkey') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_department_id_fkey
      FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_manager_id_fkey') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_department_id_fkey') THEN
    ALTER TABLE public.teams ADD CONSTRAINT teams_department_id_fkey
      FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_lead_user_id_fkey') THEN
    ALTER TABLE public.teams ADD CONSTRAINT teams_lead_user_id_fkey
      FOREIGN KEY (lead_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_team_id_fkey') THEN
    ALTER TABLE public.team_members ADD CONSTRAINT team_members_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_user_id_fkey') THEN
    ALTER TABLE public.team_members ADD CONSTRAINT team_members_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_invitations_department_id_fkey') THEN
    ALTER TABLE public.user_invitations ADD CONSTRAINT user_invitations_department_id_fkey
      FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_invitations_invited_by_fkey') THEN
    ALTER TABLE public.user_invitations ADD CONSTRAINT user_invitations_invited_by_fkey
      FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_sessions_user_id_fkey') THEN
    ALTER TABLE public.user_sessions ADD CONSTRAINT user_sessions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. Indexes used by the audit and session screens.
CREATE INDEX IF NOT EXISTS security_audit_events_created_idx
  ON public.security_audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_events_action_idx
  ON public.security_audit_events(action, created_at DESC);

-- 7. Append-only audit trail: INSERT is allowed, rewrites and deletions are not.
CREATE OR REPLACE FUNCTION public.security_audit_events_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'security_audit_events is append-only';
END;
$$;
DROP TRIGGER IF EXISTS security_audit_events_no_rewrite ON public.security_audit_events;
CREATE TRIGGER security_audit_events_no_rewrite
  BEFORE UPDATE OR DELETE ON public.security_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.security_audit_events_immutable();
