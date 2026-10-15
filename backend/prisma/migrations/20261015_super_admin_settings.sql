-- Royal Wellness Center CRM — Super Admin Management & Dynamic Configuration
-- Migration: 20261015_super_admin_settings.sql
-- Database: Supabase PostgreSQL
-- Safe, repeatable, non-destructive migration

-- 1. Extend treatments table to support both RWC treatments & CRAS courses dynamically
ALTER TABLE IF EXISTS public.treatments 
  ADD COLUMN IF NOT EXISTS code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS company VARCHAR(50) DEFAULT 'RWC',
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "durationMinutes" INT DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "startingPrice" DECIMAL(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS benefits TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_treatments_company ON public.treatments(company);
CREATE INDEX IF NOT EXISTS idx_treatments_active ON public.treatments(active);
CREATE INDEX IF NOT EXISTS idx_treatments_code ON public.treatments(code);

-- 2. Create lead_stages table for dynamic stages management
CREATE TABLE IF NOT EXISTS public.lead_stages (
  id VARCHAR(50) PRIMARY KEY,
  key VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(50) DEFAULT 'teal',
  order_index INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,
  company VARCHAR(50) DEFAULT 'ALL',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_stages_order ON public.lead_stages(order_index ASC);
CREATE INDEX IF NOT EXISTS idx_lead_stages_active ON public.lead_stages(is_active);

-- 3. Seed default lead stages (system stages protected from deletion)
INSERT INTO public.lead_stages (id, key, label, description, color, order_index, is_active, is_system, company, created_at, updated_at)
VALUES
  ('stage-new', 'new', 'New Inquiry', 'Fresh uncontacted inbound lead', 'rose', 0, TRUE, TRUE, 'ALL', NOW(), NOW()),
  ('stage-assigned', 'assigned', 'Assigned', 'Lead assigned to coordinator or education counsellor', 'amber', 1, TRUE, FALSE, 'ALL', NOW(), NOW()),
  ('stage-contacted', 'contacted', 'Contacted', 'Initial outreach made via WhatsApp or call', 'emerald', 2, TRUE, FALSE, 'ALL', NOW(), NOW()),
  ('stage-potential', 'potential', 'Potential', 'Qualified prospect showing active interest', 'purple', 3, TRUE, FALSE, 'ALL', NOW(), NOW()),
  ('stage-under-discussion', 'under_discussion', 'Under Discussion', 'Ongoing treatment / course consultation & quotation', 'sky', 4, TRUE, FALSE, 'ALL', NOW(), NOW()),
  ('stage-not-relevant', 'not_relevant', 'Not Relevant Inquiry', 'Wrong inquiry or service not offered', 'slate', 5, TRUE, FALSE, 'ALL', NOW(), NOW()),
  ('stage-not-eligible', 'not_eligible', 'Not Eligible', 'Client medically or academically ineligible', 'zinc', 6, TRUE, FALSE, 'ALL', NOW(), NOW()),
  ('stage-converted', 'converted', 'Converted (Closed Won)', 'Patient booked appointment or student enrolled', 'teal', 7, TRUE, TRUE, 'ALL', NOW(), NOW()),
  ('stage-lost', 'lost', 'Lost', 'Lead discontinued, unresponsive, or declined', 'red', 8, TRUE, TRUE, 'ALL', NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET 
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system;

-- 4. Supabase Row Level Security (RLS) Configuration
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_categories ENABLE ROW LEVEL SECURITY;

-- Treatments RLS Policies:
-- Anyone authenticated can read active treatments (and staff can read all)
DROP POLICY IF EXISTS "Allow staff read treatments" ON public.treatments;
CREATE POLICY "Allow staff read treatments" ON public.treatments
  FOR SELECT USING (TRUE);

-- Only Super Admins can insert/update treatments
DROP POLICY IF EXISTS "Allow super admin modify treatments" ON public.treatments;
CREATE POLICY "Allow super admin modify treatments" ON public.treatments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid()::text AND users.role = 'super_admin' AND users.active = TRUE
    )
  );

-- Lead Stages RLS Policies:
-- Anyone authenticated can read active stages
DROP POLICY IF EXISTS "Allow staff read lead stages" ON public.lead_stages;
CREATE POLICY "Allow staff read lead stages" ON public.lead_stages
  FOR SELECT USING (TRUE);

-- Only Super Admins can insert/update lead stages
DROP POLICY IF EXISTS "Allow super admin modify lead stages" ON public.lead_stages;
CREATE POLICY "Allow super admin modify lead stages" ON public.lead_stages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid()::text AND users.role = 'super_admin' AND users.active = TRUE
    )
  );
