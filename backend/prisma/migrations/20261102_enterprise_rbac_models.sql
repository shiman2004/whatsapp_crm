-- Enterprise RBAC & Person-Based Multi-Company Authorization Migration
-- Non-destructive, additive, idempotent DDL and data backfill

-- 1. Roles catalogue
CREATE TABLE IF NOT EXISTS public.roles (
  id VARCHAR(50) PRIMARY KEY,
  key VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'Operations',
  max_scope VARCHAR(20) NOT NULL DEFAULT 'own',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Permissions catalogue
CREATE TABLE IF NOT EXISTS public.permissions (
  id VARCHAR(100) PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  label VARCHAR(120) NOT NULL,
  description TEXT,
  default_scope VARCHAR(20) NOT NULL DEFAULT 'own',
  is_immutable BOOLEAN NOT NULL DEFAULT FALSE,
  is_delegatable BOOLEAN NOT NULL DEFAULT TRUE,
  is_role_editable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Role-Permission mappings
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id VARCHAR(36) PRIMARY KEY,
  role_key VARCHAR(50) NOT NULL,
  permission_key VARCHAR(100) NOT NULL,
  effect VARCHAR(10) NOT NULL DEFAULT 'allow',
  scope VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT role_permissions_role_key_fkey FOREIGN KEY (role_key) REFERENCES public.roles(key) ON DELETE CASCADE,
  CONSTRAINT role_permissions_perm_key_fkey FOREIGN KEY (permission_key) REFERENCES public.permissions(key) ON DELETE CASCADE,
  CONSTRAINT role_permissions_unique UNIQUE (role_key, permission_key)
);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_key);

-- 4. Company Memberships (Person -> Company)
CREATE TABLE IF NOT EXISTS public.company_memberships (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  company VARCHAR(50) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_memberships_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT company_memberships_unique UNIQUE (user_id, company)
);
CREATE INDEX IF NOT EXISTS idx_company_memberships_user ON public.company_memberships(user_id, company);

-- 5. Department Memberships (Person -> Department)
CREATE TABLE IF NOT EXISTS public.department_memberships (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  department_id VARCHAR(36) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dept_memberships_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT dept_memberships_dept_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE,
  CONSTRAINT dept_memberships_unique UNIQUE (user_id, department_id)
);
CREATE INDEX IF NOT EXISTS idx_dept_memberships_user ON public.department_memberships(user_id, department_id);

-- 6. User Role Assignments (Person -> Role within Company context)
CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  role_key VARCHAR(50) NOT NULL,
  company VARCHAR(50) NOT NULL DEFAULT 'RWC',
  department_id VARCHAR(36),
  assigned_by VARCHAR(36),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT user_role_assignments_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT user_role_assignments_role_fkey FOREIGN KEY (role_key) REFERENCES public.roles(key) ON DELETE CASCADE,
  CONSTRAINT user_role_assignments_unique UNIQUE (user_id, role_key, company)
);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_lookup ON public.user_role_assignments(user_id, company, active);

-- 7. Individual User Permission Overrides with Expiry & Conditions
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  permission_key VARCHAR(100) NOT NULL,
  effect VARCHAR(10) NOT NULL DEFAULT 'allow',
  scope VARCHAR(20),
  company VARCHAR(50) NOT NULL DEFAULT 'ALL',
  reason TEXT,
  assigned_by VARCHAR(36),
  approved_by VARCHAR(36),
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_perm_overrides_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT user_perm_overrides_perm_fkey FOREIGN KEY (permission_key) REFERENCES public.permissions(key) ON DELETE CASCADE,
  CONSTRAINT user_perm_overrides_unique UNIQUE (user_id, permission_key, company)
);
CREATE INDEX IF NOT EXISTS idx_user_perm_overrides_lookup ON public.user_permission_overrides(user_id, company);

-- 8. Access Requests & Approvals
CREATE TABLE IF NOT EXISTS public.access_requests (
  id VARCHAR(36) PRIMARY KEY,
  requester_id VARCHAR(36) NOT NULL,
  target_company VARCHAR(50),
  target_department_id VARCHAR(36),
  requested_role_key VARCHAR(50),
  requested_permission_key VARCHAR(100),
  request_type VARCHAR(50) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  duration_hours INTEGER,
  reviewed_by VARCHAR(36),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT access_requests_requester_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON public.access_requests(status, created_at DESC);

-- 9. Seed system roles
INSERT INTO public.roles (id, key, label, description, category, max_scope, is_system, active, created_at, updated_at)
VALUES
  ('super_admin', 'super_admin', 'Super Administrator', 'Full unrestricted enterprise system access across all companies and settings.', 'Administration', 'all', TRUE, TRUE, NOW(), NOW()),
  ('leads_officer', 'leads_officer', 'Inquiry Assigning Officer', 'Assigns, recalls and coordinates leads and inquiries across company pipeline.', 'Operations', 'department', TRUE, TRUE, NOW(), NOW()),
  ('coordinator', 'coordinator', 'Patient / Education Coordinator', 'Customer communication and sales conversion for assigned records.', 'Operations', 'assigned', TRUE, TRUE, NOW(), NOW()),
  ('sales_coordinator', 'sales_coordinator', 'Sales Coordinator', 'Direct lead sales engagement and academic course onboarding.', 'Operations', 'assigned', TRUE, TRUE, NOW(), NOW()),
  ('exam_department_manager', 'exam_department_manager', 'Head of Exam Department', 'Academic oversight, question bank management, and approval queue governance.', 'Departments', 'department', TRUE, TRUE, NOW(), NOW()),
  ('exam_coordinator', 'exam_coordinator', 'Exam Coordinator', 'Exam scheduling, student onboarding, and material distribution.', 'Departments', 'department', TRUE, TRUE, NOW(), NOW()),
  ('exam_providing_officer', 'exam_providing_officer', 'Exam Providing Officer', 'Material provisioning, mock test administration, and student support.', 'Departments', 'department', TRUE, TRUE, NOW(), NOW()),
  ('marketing_officer', 'marketing_officer', 'Marketing Officer', 'Contact list uploads, audience collection, and assigned marketing tasks.', 'Departments', 'assigned', TRUE, TRUE, NOW(), NOW()),
  ('marketing_admin', 'marketing_admin', 'Marketing Administrator', 'Campaign governance, audience management, and marketing reports.', 'Departments', 'department', TRUE, TRUE, NOW(), NOW()),
  ('clinical_nurse', 'clinical_nurse', 'Clinical Nurse', 'Patient triage, vital assessments, and clinical photo collection.', 'Departments', 'own', TRUE, TRUE, NOW(), NOW()),
  ('clinical_doctor', 'clinical_doctor', 'Clinical Doctor', 'Medical consultation review, treatment planning, and clinical approval.', 'Departments', 'assigned', TRUE, TRUE, NOW(), NOW()),
  ('report_analyst', 'report_analyst', 'Report Analyst', 'Clinical assessment reporting and conversion analytics drafting.', 'Departments', 'assigned', TRUE, TRUE, NOW(), NOW()),
  ('finance_officer', 'finance_officer', 'Finance Officer', 'Payment verification, invoice management, and financial audit.', 'Operations', 'all', TRUE, TRUE, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  max_scope = EXCLUDED.max_scope,
  is_system = EXCLUDED.is_system,
  active = EXCLUDED.active,
  updated_at = NOW();

-- 10. Seed standard permissions
INSERT INTO public.permissions (id, key, module, action, label, description, default_scope, is_immutable, is_delegatable, is_role_editable)
VALUES
  ('crm.contact.view', 'crm.contact.view', 'crm', 'View', 'CRM: View', 'Enter and read permitted contacts and leads.', 'assigned', FALSE, TRUE, TRUE),
  ('crm.contact.create', 'crm.contact.create', 'crm', 'Create', 'CRM: Create', 'Create new contacts and leads.', 'assigned', FALSE, TRUE, TRUE),
  ('crm.contact.update', 'crm.contact.update', 'crm', 'Update', 'CRM: Update', 'Modify authorized contacts and leads.', 'assigned', FALSE, TRUE, TRUE),
  ('crm.contact.assign', 'crm.contact.assign', 'crm', 'Assign', 'CRM: Assign', 'Assign records to staff.', 'assigned', FALSE, TRUE, TRUE),
  ('crm.contact.reassign', 'crm.contact.reassign', 'crm', 'Reassign', 'CRM: Reassign', 'Transfer assigned records between staff.', 'assigned', FALSE, TRUE, TRUE),
  ('crm.contact.export', 'crm.contact.export', 'crm', 'Export', 'CRM: Export', 'Export permitted CRM data.', 'assigned', FALSE, TRUE, TRUE),
  ('crm.contact.delete', 'crm.contact.delete', 'crm', 'Delete', 'CRM: Delete', 'Delete records when explicitly authorized.', 'all', TRUE, FALSE, FALSE),

  ('exam.operations.view', 'exam.operations.view', 'exam', 'View', 'Exam Operations: View', 'View assigned exam operations and handoffs.', 'own', FALSE, TRUE, TRUE),
  ('exam.operations.submit', 'exam.operations.submit', 'exam', 'Submit', 'Exam Operations: Submit', 'Submit exam requirements and sales handoffs.', 'own', FALSE, TRUE, TRUE),
  ('exam.operations.manage', 'exam.operations.manage', 'exam', 'Manage', 'Exam Operations: Manage', 'Accept, assign and administer exam operations.', 'department', TRUE, FALSE, FALSE),
  ('exam.academic.view', 'exam.academic.view', 'exam', 'View', 'Academic Content: View', 'View authorized academic modules.', 'department', FALSE, TRUE, TRUE),
  ('exam.course.create_draft', 'exam.course.create_draft', 'exam', 'Create', 'Course: Create draft', 'Create permitted course drafts.', 'own', FALSE, TRUE, TRUE),
  ('exam.material.create_draft', 'exam.material.create_draft', 'exam', 'Create', 'Study Material: Create draft', 'Create study material drafts.', 'own', FALSE, TRUE, TRUE),
  ('exam.question.create_draft', 'exam.question.create_draft', 'exam', 'Create', 'Question Bank: Create draft', 'Create question drafts.', 'own', FALSE, TRUE, TRUE),
  ('exam.mock_test.create_draft', 'exam.mock_test.create_draft', 'exam', 'Create', 'Mock Test: Create draft', 'Create mock test drafts.', 'own', FALSE, TRUE, TRUE),
  ('exam.draft.edit_own', 'exam.draft.edit_own', 'exam', 'Update', 'Academic Drafts: Edit own', 'Edit own unpublished drafts.', 'own', FALSE, TRUE, TRUE),
  ('exam.draft.submit', 'exam.draft.submit', 'exam', 'Submit', 'Academic Drafts: Submit', 'Submit own drafts for review.', 'own', FALSE, TRUE, TRUE),
  ('exam.content.review', 'exam.content.review', 'exam', 'Approve', 'Academic Content: Review', 'Review drafts and request changes.', 'department', TRUE, FALSE, FALSE),
  ('exam.content.publish', 'exam.content.publish', 'exam', 'Publish', 'Academic Content: Publish', 'Publish authorized academic content.', 'department', TRUE, FALSE, FALSE),
  ('exam.content.delete', 'exam.content.delete', 'exam', 'Delete', 'Academic Content: Delete', 'Delete published academic content.', 'department', TRUE, FALSE, FALSE),
  ('exam.finance.verify', 'exam.finance.verify', 'exam', 'Approve', 'Payment: Verify', 'Verify bank and transaction payments independently.', 'all', TRUE, FALSE, FALSE),

  ('clinical.assessment.view_own', 'clinical.assessment.view_own', 'clinical', 'View', 'Assessments: View own', 'View own patient assessments.', 'own', FALSE, TRUE, FALSE),
  ('clinical.assessment.create', 'clinical.assessment.create', 'clinical', 'Create', 'Assessments: Create', 'Create own patient assessments.', 'own', FALSE, TRUE, FALSE),
  ('clinical.assessment.update_own', 'clinical.assessment.update_own', 'clinical', 'Update', 'Assessments: Edit own', 'Edit own permitted assessments.', 'own', FALSE, TRUE, FALSE),
  ('clinical.assessment.submit', 'clinical.assessment.submit', 'clinical', 'Submit', 'Assessments: Submit', 'Submit assessments to doctors.', 'own', FALSE, TRUE, FALSE),
  ('clinical.assessment.view_assigned', 'clinical.assessment.view_assigned', 'clinical', 'View', 'Assessments: View assigned', 'View assessments assigned to you.', 'assigned', FALSE, TRUE, FALSE),
  ('clinical.assessment.review', 'clinical.assessment.review', 'clinical', 'Update', 'Assessments: Review', 'Record doctor review decisions.', 'assigned', FALSE, TRUE, FALSE),
  ('clinical.assessment.approve', 'clinical.assessment.approve', 'clinical', 'Approve', 'Assessments: Approve', 'Approve clinical results.', 'assigned', TRUE, FALSE, FALSE),
  ('clinical.report.view_assigned', 'clinical.report.view_assigned', 'clinical', 'View', 'Clinical Reports: View', 'View the assigned clinical report queue.', 'assigned', FALSE, TRUE, FALSE),
  ('clinical.report.draft', 'clinical.report.draft', 'clinical', 'Create', 'Clinical Reports: Draft', 'Prepare clinical report drafts.', 'assigned', FALSE, TRUE, FALSE),

  ('marketing.dashboard', 'marketing.dashboard', 'marketing', 'View', 'Marketing: Dashboard', 'Open the marketing dashboard.', 'department', FALSE, TRUE, FALSE),
  ('marketing.collect', 'marketing.collect', 'marketing', 'Create', 'Marketing: Collect contacts', 'Collect and upload marketing contacts.', 'own', FALSE, TRUE, FALSE),
  ('marketing.view_own_uploads', 'marketing.view_own_uploads', 'marketing', 'View', 'Marketing: View own uploads', 'View your own collected contacts.', 'own', FALSE, TRUE, FALSE),
  ('marketing.view_assigned_tasks', 'marketing.view_assigned_tasks', 'marketing', 'View', 'Marketing: View assigned tasks', 'View assigned marketing follow-up tasks.', 'assigned', FALSE, TRUE, FALSE),
  ('marketing.update_assigned_tasks', 'marketing.update_assigned_tasks', 'marketing', 'Update', 'Marketing: Update assigned tasks', 'Update assigned marketing follow-up tasks.', 'assigned', FALSE, TRUE, FALSE),
  ('marketing.manage_campaign_drafts', 'marketing.manage_campaign_drafts', 'marketing', 'Manage', 'Marketing: Manage campaign drafts', 'Manage campaign drafts.', 'department', FALSE, TRUE, FALSE),
  ('marketing.view_reports', 'marketing.view_reports', 'marketing', 'View', 'Marketing: View reports', 'View marketing reports.', 'department', FALSE, TRUE, FALSE),
  ('marketing.assign', 'marketing.assign', 'marketing', 'Assign', 'Marketing: Assign contacts', 'Assign marketing contacts to officers.', 'department', FALSE, TRUE, FALSE),
  ('marketing.reassign', 'marketing.reassign', 'marketing', 'Reassign', 'Marketing: Reassign contacts', 'Reassign marketing contacts between officers.', 'department', FALSE, TRUE, FALSE),
  ('marketing.export', 'marketing.export', 'marketing', 'Export', 'Marketing: Export', 'Export marketing contacts.', 'department', FALSE, TRUE, FALSE),
  ('marketing.approve_campaigns', 'marketing.approve_campaigns', 'marketing', 'Approve', 'Marketing: Approve campaigns', 'Approve marketing campaigns.', 'department', TRUE, FALSE, FALSE),
  ('marketing.audit', 'marketing.audit', 'marketing', 'View', 'Marketing: Audit trail', 'View marketing audit events.', 'department', FALSE, TRUE, FALSE),
  ('marketing.delete_contacts', 'marketing.delete_contacts', 'marketing', 'Delete', 'Marketing: Delete contacts', 'Delete marketing contacts.', 'department', TRUE, FALSE, FALSE),

  ('reports.view', 'reports.view', 'reports', 'View', 'Reports: View', 'View analytics dashboards.', 'all', FALSE, FALSE, FALSE),
  ('reports.export', 'reports.export', 'reports', 'Export', 'Reports: Export', 'Export report data.', 'all', FALSE, FALSE, FALSE),

  ('staff.view', 'staff.view', 'staff', 'View', 'Staff: View directory', 'View the staff directory.', 'all', FALSE, FALSE, FALSE),
  ('staff.manage', 'staff.manage', 'staff', 'Manage', 'Staff: Manage accounts', 'Create, edit and deactivate staff accounts.', 'all', TRUE, FALSE, FALSE),
  ('staff.audit.view', 'staff.audit.view', 'staff', 'View', 'Staff: Audit trail', 'View security and system audit trails.', 'all', TRUE, FALSE, FALSE),
  ('staff.security.manage', 'staff.security.manage', 'staff', 'Manage', 'Staff: Security administration', 'Manage roles, permissions and security policy.', 'all', TRUE, FALSE, FALSE),

  ('system.settings.manage', 'system.settings.manage', 'system', 'Manage', 'System: Settings', 'Manage system configuration.', 'all', TRUE, FALSE, FALSE),
  ('system.integrations.manage', 'system.integrations.manage', 'system', 'Manage', 'System: Integrations', 'Manage API and webhook integrations.', 'all', TRUE, FALSE, FALSE)
ON CONFLICT (key) DO UPDATE SET
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  default_scope = EXCLUDED.default_scope,
  is_immutable = EXCLUDED.is_immutable,
  is_delegatable = EXCLUDED.is_delegatable,
  is_role_editable = EXCLUDED.is_role_editable;

-- 11. Backfill Company Memberships from existing users
INSERT INTO public.company_memberships (id, user_id, company, is_default, active, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  u.id,
  COALESCE(NULLIF(u.company, ''), 'RWC'),
  TRUE,
  COALESCE(u.active, TRUE),
  NOW(),
  NOW()
FROM public.users u
ON CONFLICT (user_id, company) DO NOTHING;

-- Super Admin receives ALL company memberships
INSERT INTO public.company_memberships (id, user_id, company, is_default, active, created_at, updated_at)
SELECT gen_random_uuid()::text, u.id, c.comp, FALSE, TRUE, NOW(), NOW()
FROM public.users u
CROSS JOIN (VALUES ('RWC'), ('CRAS'), ('AHC')) AS c(comp)
WHERE u.role = 'super_admin'
ON CONFLICT (user_id, company) DO NOTHING;

-- 12. Backfill Department Memberships from existing users where department_id is set
INSERT INTO public.department_memberships (id, user_id, department_id, is_primary, active, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  u.id,
  u.department_id,
  TRUE,
  COALESCE(u.active, TRUE),
  NOW(),
  NOW()
FROM public.users u
WHERE u.department_id IS NOT NULL
ON CONFLICT (user_id, department_id) DO NOTHING;

-- 13. Backfill User Role Assignments from existing users
INSERT INTO public.user_role_assignments (id, user_id, role_key, company, active, assigned_at)
SELECT
  gen_random_uuid()::text,
  u.id,
  u.role::text,
  COALESCE(NULLIF(u.company, ''), 'RWC'),
  COALESCE(u.active, TRUE),
  NOW()
FROM public.users u
JOIN public.roles r ON r.key = u.role::text
ON CONFLICT (user_id, role_key, company) DO NOTHING;

