-- Add lead handoff stages used by the Sales -> Exam/Processing workflow.
-- Safe to run repeatedly on an existing Supabase PostgreSQL database.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'sales_coordinator';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'exam_department_manager';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'exam_coordinator';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'exam_providing_officer';

ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'forwarded_to_exam_department';
ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'forwarded_to_processing_department';

INSERT INTO public.lead_stages
  (id, key, label, description, color, order_index, is_active, is_system, company, created_at, updated_at)
VALUES
  ('stage-forwarded-exam', 'forwarded_to_exam_department', 'Forwarded to Exam Department', 'Lead handed over to the healthcare exam preparation team.', 'cyan', 5, TRUE, FALSE, 'ALL', NOW(), NOW()),
  ('stage-forwarded-processing', 'forwarded_to_processing_department', 'Forwarded to Processing Department', 'Lead handed over to the document and application processing team.', 'orange', 6, TRUE, FALSE, 'ALL', NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  is_active = TRUE,
  updated_at = NOW();
