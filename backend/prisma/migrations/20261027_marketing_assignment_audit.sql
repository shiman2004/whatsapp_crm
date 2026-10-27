-- Additive audit fields only. Existing assignment facts stay unchanged.
ALTER TABLE public.marketing_contacts
  ADD COLUMN IF NOT EXISTS last_reassigned_at TIMESTAMPTZ;

ALTER TABLE public.marketing_assignment_history
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(30) NOT NULL DEFAULT 'assigned';

CREATE INDEX IF NOT EXISTS marketing_contacts_last_reassigned_at_idx
  ON public.marketing_contacts(last_reassigned_at);
