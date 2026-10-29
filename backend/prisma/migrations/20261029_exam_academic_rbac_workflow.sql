-- Exam Department Academic RBAC & Content Approval Lifecycle Migration
-- Adds status, creator, reviewer, and audit tracking for academic content drafts.

ALTER TABLE public.exam_courses ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Draft';
ALTER TABLE public.exam_courses ADD COLUMN IF NOT EXISTS reviewer_id VARCHAR(100);
ALTER TABLE public.exam_courses ADD COLUMN IF NOT EXISTS review_comments TEXT;
ALTER TABLE public.exam_courses ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.exam_study_materials ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
ALTER TABLE public.exam_study_materials ADD COLUMN IF NOT EXISTS reviewer_id VARCHAR(100);
ALTER TABLE public.exam_study_materials ADD COLUMN IF NOT EXISTS review_comments TEXT;
ALTER TABLE public.exam_study_materials ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS reviewer_id VARCHAR(100);
ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS review_comments TEXT;
ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.exam_mock_tests ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Draft';
ALTER TABLE public.exam_mock_tests ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
ALTER TABLE public.exam_mock_tests ADD COLUMN IF NOT EXISTS reviewer_id VARCHAR(100);
ALTER TABLE public.exam_mock_tests ADD COLUMN IF NOT EXISTS review_comments TEXT;
ALTER TABLE public.exam_mock_tests ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS public.exam_academic_audit (
  id VARCHAR(100) PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  actor_id VARCHAR(100) NOT NULL,
  actor_name VARCHAR(150),
  actor_role VARCHAR(50),
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_academic_audit_entity ON public.exam_academic_audit(entity_type, entity_id);

