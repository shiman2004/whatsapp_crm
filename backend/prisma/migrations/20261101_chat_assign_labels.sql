-- Royal Wellness Center CRM — Dynamic Assign Labels & Supabase Cloud Sync
-- Migration: 20261101_chat_assign_labels.sql
-- Database: Supabase PostgreSQL
-- Safe, idempotent, non-destructive migration

-- 1. Create chat_labels table for dynamic assign labels
CREATE TABLE IF NOT EXISTS public.chat_labels (
  id VARCHAR(50) PRIMARY KEY,
  key VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(50) NOT NULL DEFAULT '#f59e0b',
  dot_color VARCHAR(50) DEFAULT 'bg-amber-400',
  bg_color VARCHAR(100) DEFAULT 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  description TEXT,
  company VARCHAR(50) DEFAULT 'ALL',
  allowed_roles VARCHAR(255) DEFAULT 'ALL',
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,
  order_index INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_labels_order ON public.chat_labels(order_index ASC);
CREATE INDEX IF NOT EXISTS idx_chat_labels_active ON public.chat_labels(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_labels_company ON public.chat_labels(company);

-- 2. Create lead_label_assignments table for tracking assigned labels on leads in Supabase
CREATE TABLE IF NOT EXISTS public.lead_label_assignments (
  id VARCHAR(50) PRIMARY KEY,
  lead_id VARCHAR(50) NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  label_id VARCHAR(50) NOT NULL,
  assigned_by VARCHAR(50),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_lead_label_assignment UNIQUE (lead_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_label_lead ON public.lead_label_assignments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_label_label ON public.lead_label_assignments(label_id);

-- 3. Seed default preset labels (VIP Patient, Hot Lead, Consultation Booked, Follow-up Needed, Prescription Sent)
INSERT INTO public.chat_labels (id, key, name, color, dot_color, bg_color, description, company, allowed_roles, is_active, is_system, order_index, created_at, updated_at)
VALUES
  ('vip', 'vip', 'VIP Patient', '#f59e0b', 'bg-amber-400', 'bg-amber-500/20 text-amber-300 border-amber-500/30', 'High-priority VIP customer requiring dedicated attention', 'ALL', 'ALL', TRUE, TRUE, 0, NOW(), NOW()),
  ('hot', 'hot', 'Hot Lead', '#f43f5e', 'bg-rose-400', 'bg-rose-500/20 text-rose-300 border-rose-500/30', 'Urgent prospective patient or student ready to convert', 'ALL', 'ALL', TRUE, TRUE, 1, NOW(), NOW()),
  ('booked', 'booked', 'Consultation Booked', '#10b981', 'bg-emerald-400', 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', 'Clinical consultation or course admission confirmed', 'ALL', 'ALL', TRUE, TRUE, 2, NOW(), NOW()),
  ('followup', 'followup', 'Follow-up Needed', '#0ea5e9', 'bg-sky-400', 'bg-sky-500/20 text-sky-300 border-sky-500/30', 'Pending client reply or scheduled follow-up outreach', 'ALL', 'ALL', TRUE, TRUE, 3, NOW(), NOW()),
  ('prescription', 'prescription', 'Prescription Sent', '#8b5cf6', 'bg-purple-400', 'bg-purple-500/20 text-purple-300 border-purple-500/30', 'Medical prescription or academic syllabus forwarded', 'ALL', 'ALL', TRUE, TRUE, 4, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  is_system = EXCLUDED.is_system;

-- 4. Enable RLS on both tables
ALTER TABLE public.chat_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_label_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow staff read chat labels" ON public.chat_labels;
CREATE POLICY "Allow staff read chat labels" ON public.chat_labels FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Allow super admin modify chat labels" ON public.chat_labels;
CREATE POLICY "Allow super admin modify chat labels" ON public.chat_labels FOR ALL USING (TRUE);

DROP POLICY IF EXISTS "Allow staff read and manage lead label assignments" ON public.lead_label_assignments;
CREATE POLICY "Allow staff read and manage lead label assignments" ON public.lead_label_assignments FOR ALL USING (TRUE);

