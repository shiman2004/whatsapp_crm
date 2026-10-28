-- Additive migration. Run explicitly against an approved database; never on GET.
CREATE TABLE IF NOT EXISTS public.exam_ops_records (
  kind text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, id),
  CHECK (jsonb_typeof(data) = 'object')
);
CREATE INDEX IF NOT EXISTS exam_ops_owner_idx ON public.exam_ops_records(kind, (data->>'ownerId'));
CREATE INDEX IF NOT EXISTS exam_ops_email_idx ON public.exam_ops_records(kind, (data->>'email'));
CREATE INDEX IF NOT EXISTS exam_ops_status_idx ON public.exam_ops_records(kind, (data->>'status'));
-- Orders, verified email identities and challenge consumption use stable keys.
-- Locking mutations and challenge consumption occur inside database transactions.
CREATE TABLE IF NOT EXISTS public.exam_ops_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL,
  action text NOT NULL,
  target text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
