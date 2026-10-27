-- Expand first: explicit Public Contact Marketing access, preserving existing marketing staff.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS marketing_access BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE public.users
SET marketing_access = TRUE
WHERE active = TRUE AND role IN ('coordinator', 'marketing_officer', 'leads_officer') AND marketing_access = FALSE;
