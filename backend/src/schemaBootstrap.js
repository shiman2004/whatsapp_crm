/**
 * Database schema bootstrap.
 *
 * These statements previously ran inline on every `checkDbConnection()` call with
 * `.catch(() => null)`, which silently hid provisioning failures and re-issued the
 * same DDL on every health check. They are kept here (rather than only in Prisma
 * migrations) because production databases were originally created without
 * `prisma migrate`, so the delta must be applied idempotently at least once.
 *
 * They run once per process. Failures are collected and reported instead of being
 * swallowed, so a missing table cannot masquerade as a healthy database.
 *
 * When the reviewed migrations in `prisma/migrations/` are confirmed applied on
 * every environment, this module can be deleted and the app can rely on
 * `prisma migrate deploy` alone.
 */

const STATEMENTS = [
  // --- leads table shape -------------------------------------------------------
  `ALTER TABLE "leads" ALTER COLUMN "categoryId" DROP NOT NULL;`,
  `ALTER TABLE "leads" ALTER COLUMN "treatmentId" DROP NOT NULL;`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "serialNumber" VARCHAR(50);`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "source" VARCHAR(50) DEFAULT 'RWC';`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "company" VARCHAR(50) DEFAULT 'RWC';`,

  // --- company-scoped lead serial allocator (atomic, single statement) ---------
  `CREATE TABLE IF NOT EXISTS public.company_lead_serials (
     company VARCHAR(10) PRIMARY KEY,
     next_value INTEGER NOT NULL DEFAULT 1
   );`,
  `INSERT INTO public.company_lead_serials (company, next_value)
   VALUES ('RWC', 1), ('CRAS', 1)
   ON CONFLICT (company) DO NOTHING;`,
  `CREATE OR REPLACE FUNCTION public.next_company_lead_serial(company_code VARCHAR)
   RETURNS VARCHAR LANGUAGE plpgsql AS $serial$
   DECLARE
     normalized_company VARCHAR(10) := CASE WHEN upper(company_code) = 'CRAS' THEN 'CRAS' ELSE 'RWC' END;
     allocated_value INTEGER;
     candidate_serial VARCHAR(50);
     serial_exists BOOLEAN;
   BEGIN
     INSERT INTO public.company_lead_serials (company, next_value) VALUES (normalized_company, 1) ON CONFLICT (company) DO NOTHING;
     LOOP
       UPDATE public.company_lead_serials
       SET next_value = next_value + 1
       WHERE company = normalized_company
       RETURNING next_value - 1 INTO allocated_value;

       candidate_serial := normalized_company || '-' || lpad(allocated_value::text, 4, '0');

       SELECT EXISTS(
         SELECT 1 FROM public.leads WHERE "serialNumber" = candidate_serial
       ) INTO serial_exists;

       IF NOT serial_exists THEN
         RETURN candidate_serial;
       END IF;
     END LOOP;
   END;
   $serial$;`,

  // --- persistent media storage ------------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.media_files (
     id VARCHAR(255) PRIMARY KEY,
     file_name VARCHAR(255) UNIQUE NOT NULL,
     mime_type VARCHAR(100) NOT NULL,
     data BYTEA NOT NULL,
     size INT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_media_files_name ON public.media_files(file_name);`,

  // --- shared login throttling -------------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
     rate_key VARCHAR(512) PRIMARY KEY,
     attempt_count INTEGER NOT NULL DEFAULT 0,
     first_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
     locked_until TIMESTAMP WITH TIME ZONE,
     updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_expiry ON public.auth_rate_limits(locked_until, updated_at);`,

  // --- security audit trail ----------------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.security_audit_events (
     id VARCHAR(50) PRIMARY KEY,
     correlation_id VARCHAR(100) NOT NULL,
     actor_id VARCHAR(100),
     action VARCHAR(100) NOT NULL,
     resource VARCHAR(255) NOT NULL,
     outcome VARCHAR(40) NOT NULL,
     metadata TEXT,
     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_security_audit_created ON public.security_audit_events(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_security_audit_actor ON public.security_audit_events(actor_id, created_at DESC);`,

  // --- staff broadcasts --------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.team_broadcasts (
     id VARCHAR(50) PRIMARY KEY,
     sender_id VARCHAR(36) NOT NULL,
     sender_name VARCHAR(255) NOT NULL,
     sender_role VARCHAR(50) NOT NULL,
     company VARCHAR(50) DEFAULT 'ALL',
     title VARCHAR(255),
     content TEXT NOT NULL,
     media_type VARCHAR(50),
     media_url TEXT,
     file_name VARCHAR(255),
     file_size INT,
     is_pinned BOOLEAN DEFAULT FALSE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON public.team_broadcasts(created_at DESC);`,

  // --- permanent sender audit trail -------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.message_audits (
     id VARCHAR(50) PRIMARY KEY,
     message_id VARCHAR(100) UNIQUE NOT NULL,
     lead_id VARCHAR(50) NOT NULL,
     customer_id VARCHAR(50),
     company VARCHAR(50),
     whatsapp_number VARCHAR(50),
     sender_id VARCHAR(36),
     sender_name VARCHAR(255) NOT NULL,
     sender_role VARCHAR(50) NOT NULL,
     message_source VARCHAR(50) DEFAULT 'CRM User',
     delivery_status VARCHAR(50) DEFAULT 'sent',
     sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_message_audits_lead ON public.message_audits(lead_id);`,
  `CREATE INDEX IF NOT EXISTS idx_message_audits_sender ON public.message_audits(sender_id);`,
  `CREATE INDEX IF NOT EXISTS idx_message_audits_sent ON public.message_audits(sent_at DESC);`,

  // --- messages sender audit columns ------------------------------------------
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "senderName" VARCHAR(255);`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "senderRole" VARCHAR(50);`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "messageSource" VARCHAR(50) DEFAULT 'CRM User';`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255);`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS sender_role VARCHAR(50);`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS message_source VARCHAR(50) DEFAULT 'CRM User';`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`,

  // --- UserRole enum values ----------------------------------------------------
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'leads_officer';`,

  // --- LeadStage enum values ---------------------------------------------------
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'new';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'assigned';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'contacted';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'potential';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'under_discussion';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'not_relevant';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'not_eligible';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'converted';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'lost';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'interested';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'follow_up';`,

  // --- global settings ---------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.system_settings (
     key VARCHAR(100) PRIMARY KEY,
     value TEXT NOT NULL,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `INSERT INTO public.system_settings (key, value, updated_at)
   VALUES ('META_VERIFY_TOKEN', 'royal_wellness_token_2026', NOW())
   ON CONFLICT (key) DO NOTHING;`,

  // --- treatments columns ------------------------------------------------------
  `ALTER TABLE "treatments" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50);`,
  `ALTER TABLE "treatments" ADD COLUMN IF NOT EXISTS "company" VARCHAR(50) DEFAULT 'RWC';`,
  `ALTER TABLE "treatments" ADD COLUMN IF NOT EXISTS "active" BOOLEAN DEFAULT TRUE;`,
  `CREATE INDEX IF NOT EXISTS idx_treatments_company ON "treatments"("company");`,
  `CREATE INDEX IF NOT EXISTS idx_treatments_code ON "treatments"("code");`,

  // --- dynamic lead stages -----------------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.lead_stages (
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
   );`,
  `CREATE INDEX IF NOT EXISTS idx_lead_stages_order ON public.lead_stages(order_index ASC);`,
  `CREATE INDEX IF NOT EXISTS idx_lead_stages_active ON public.lead_stages(is_active);`,

  // --- appointment scheduling --------------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.branches (
     id VARCHAR(50) PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     code VARCHAR(50) UNIQUE NOT NULL,
     address TEXT,
     phone VARCHAR(50),
     is_active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE TABLE IF NOT EXISTS public.rooms (
     id VARCHAR(50) PRIMARY KEY,
     branch_id VARCHAR(50) NOT NULL,
     name VARCHAR(255) NOT NULL,
     room_number VARCHAR(50) NOT NULL,
     description TEXT,
     color VARCHAR(50) DEFAULT '#0d9488',
     operating_start VARCHAR(10) DEFAULT '08:00',
     operating_end VARCHAR(10) DEFAULT '20:00',
     is_active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_branch ON public.rooms(branch_id);`,
  `CREATE TABLE IF NOT EXISTS public.doctors (
     id VARCHAR(50) PRIMARY KEY,
     full_name VARCHAR(255) NOT NULL,
     title VARCHAR(255),
     branch VARCHAR(100),
     phone VARCHAR(50),
     avatar VARCHAR(500),
     is_active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_doctors_branch ON public.doctors(branch);`,
  `CREATE INDEX IF NOT EXISTS idx_doctors_active ON public.doctors(is_active);`,
  `CREATE TABLE IF NOT EXISTS public.room_treatments (
     room_id VARCHAR(50) NOT NULL,
     treatment_id VARCHAR(50) NOT NULL,
     PRIMARY KEY (room_id, treatment_id)
   );`,
  `CREATE TABLE IF NOT EXISTS public.appointments (
     id VARCHAR(50) PRIMARY KEY,
     branch_id VARCHAR(50) NOT NULL,
     room_id VARCHAR(50) NOT NULL,
     patient_id VARCHAR(50) NOT NULL,
     doctor_id VARCHAR(50) NOT NULL,
     treatment_id VARCHAR(50) NOT NULL,
     start_time TIMESTAMP WITH TIME ZONE NOT NULL,
     end_time TIMESTAMP WITH TIME ZONE NOT NULL,
     status VARCHAR(50) DEFAULT 'confirmed',
     notes TEXT,
     created_by_id VARCHAR(50),
     updated_by_id VARCHAR(50),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     cancelled_at TIMESTAMP WITH TIME ZONE,
     cancellation_reason TEXT
   );`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_branch_time ON public.appointments(branch_id, start_time);`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_room_time ON public.appointments(room_id, start_time, end_time);`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_doctor_time ON public.appointments(doctor_id, start_time, end_time);`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);`,
  `CREATE TABLE IF NOT EXISTS public.appointment_status_history (
     id VARCHAR(50) PRIMARY KEY,
     appointment_id VARCHAR(50) NOT NULL,
     previous_status VARCHAR(50),
     new_status VARCHAR(50) NOT NULL,
     changed_by_id VARCHAR(50),
     changed_by_name VARCHAR(255),
     reason TEXT,
     changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_appt_hist_appointment ON public.appointment_status_history(appointment_id);`,
  `CREATE TABLE IF NOT EXISTS public.availability_blocks (
     id VARCHAR(50) PRIMARY KEY,
     branch_id VARCHAR(50) NOT NULL,
     room_id VARCHAR(50),
     doctor_id VARCHAR(50),
     start_time TIMESTAMP WITH TIME ZONE NOT NULL,
     end_time TIMESTAMP WITH TIME ZONE NOT NULL,
     reason VARCHAR(255) NOT NULL,
     created_by_id VARCHAR(50),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_avail_blocks_branch ON public.availability_blocks(branch_id, start_time, end_time);`,

  // --- Exam Department Module Tables ----------------------------------------
  `CREATE TABLE IF NOT EXISTS public.exam_categories (
     id VARCHAR(100) PRIMARY KEY,
     name VARCHAR(100) NOT NULL,
     code VARCHAR(50) UNIQUE NOT NULL,
     description TEXT,
     icon VARCHAR(50) DEFAULT 'GraduationCap',
     color VARCHAR(50) DEFAULT '#06b6d4',
     is_active BOOLEAN DEFAULT TRUE,
     display_order INTEGER DEFAULT 0,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_exam_categories_order ON public.exam_categories(display_order);`,

  `CREATE TABLE IF NOT EXISTS public.exam_materials (
     id VARCHAR(100) PRIMARY KEY,
     title VARCHAR(255) NOT NULL,
     category_id VARCHAR(100),
     category_name VARCHAR(100),
     type VARCHAR(50) NOT NULL,
     description TEXT,
     file_name VARCHAR(255),
     file_url TEXT,
     file_type VARCHAR(100),
     file_size BIGINT DEFAULT 0,
     file_size_formatted VARCHAR(50),
     external_url TEXT,
     target_profession VARCHAR(100),
     uploaded_by VARCHAR(100),
     uploader_name VARCHAR(100),
     download_count INTEGER DEFAULT 0,
     is_active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_exam_materials_cat ON public.exam_materials(category_id);`,
  `CREATE INDEX IF NOT EXISTS idx_exam_materials_type ON public.exam_materials(type);`,

  `CREATE TABLE IF NOT EXISTS public.exam_material_requests (
     id VARCHAR(100) PRIMARY KEY,
     request_number VARCHAR(50) UNIQUE,
     title VARCHAR(255) NOT NULL,
     category_id VARCHAR(100),
     category_name VARCHAR(100),
     type VARCHAR(50) NOT NULL,
     requested_by VARCHAR(100) NOT NULL,
     requester_id VARCHAR(100),
     candidate_name VARCHAR(150),
     candidate_phone VARCHAR(50),
     lead_id VARCHAR(100),
     request_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     status VARCHAR(50) DEFAULT 'Pending',
     urgency VARCHAR(20) DEFAULT 'Normal',
     notes TEXT,
     material_id VARCHAR(100),
     reviewed_by VARCHAR(100),
     reviewed_at TIMESTAMP WITH TIME ZONE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_exam_requests_status ON public.exam_material_requests(status);`,
  `CREATE INDEX IF NOT EXISTS idx_exam_requests_cat ON public.exam_material_requests(category_id);`,

  `CREATE TABLE IF NOT EXISTS public.exam_mock_tests (
     id VARCHAR(100) PRIMARY KEY,
     title VARCHAR(255) NOT NULL,
     category_id VARCHAR(100),
     category_name VARCHAR(100),
     target_profession VARCHAR(100),
     total_questions INTEGER DEFAULT 50,
     duration_minutes INTEGER DEFAULT 60,
     passing_score INTEGER DEFAULT 70,
     difficulty VARCHAR(20) DEFAULT 'Medium',
     question_paper_url TEXT,
     answer_key_url TEXT,
     explanation_url TEXT,
     is_active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_exam_mock_cat ON public.exam_mock_tests(category_id);`,

  `CREATE TABLE IF NOT EXISTS public.exam_provisions (
     id VARCHAR(100) PRIMARY KEY,
     candidate_name VARCHAR(150) NOT NULL,
     candidate_phone VARCHAR(50),
     candidate_email VARCHAR(150),
     lead_id VARCHAR(100),
     category_id VARCHAR(100),
     category_name VARCHAR(100),
     package_name VARCHAR(255) NOT NULL,
     provision_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     valid_until TIMESTAMP WITH TIME ZONE,
     access_status VARCHAR(50) DEFAULT 'Active',
     materials_included JSONB DEFAULT '[]'::jsonb,
     provided_by VARCHAR(100),
     notes TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_exam_provisions_cat ON public.exam_provisions(category_id);`,
  `CREATE INDEX IF NOT EXISTS idx_exam_provisions_status ON public.exam_provisions(access_status);`,

  // --- Interactive MCQ Practice Module Tables -------------------------------
  `CREATE TABLE IF NOT EXISTS public.exam_mcq_questions (
     id VARCHAR(100) PRIMARY KEY,
     title VARCHAR(255) NOT NULL,
     question_text TEXT NOT NULL,
     category_id VARCHAR(100),
     category_name VARCHAR(100),
     subject VARCHAR(150) DEFAULT 'General Medicine',
     image_url TEXT,
     option_a TEXT NOT NULL,
     option_b TEXT NOT NULL,
     option_c TEXT NOT NULL,
     option_d TEXT NOT NULL,
     option_e TEXT NOT NULL,
     correct_answer VARCHAR(5) NOT NULL,
     remember_note_1 TEXT NOT NULL,
     remember_note_2 TEXT NOT NULL,
     remember_note_3 TEXT NOT NULL,
     explanation TEXT,
     difficulty VARCHAR(20) DEFAULT 'Medium',
     display_order INTEGER DEFAULT 0,
     is_active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_exam_mcq_cat ON public.exam_mcq_questions(category_id);`,
  `CREATE INDEX IF NOT EXISTS idx_exam_mcq_active ON public.exam_mcq_questions(is_active);`,
  `CREATE INDEX IF NOT EXISTS idx_exam_mcq_order ON public.exam_mcq_questions(display_order);`,

  `CREATE TABLE IF NOT EXISTS public.exam_mcq_practice_attempts (
     id VARCHAR(100) PRIMARY KEY,
     session_id VARCHAR(100),
     student_id VARCHAR(100),
     student_name VARCHAR(150) NOT NULL,
     student_identifier VARCHAR(100),
     exam_title VARCHAR(255),
     category_id VARCHAR(100),
     question_id VARCHAR(100) NOT NULL,
     question_title VARCHAR(255),
     first_selected_answer VARCHAR(5) NOT NULL,
     number_of_attempts INTEGER NOT NULL DEFAULT 1,
     attempts_history JSONB DEFAULT '[]'::jsonb,
     final_correct_answer VARCHAR(5) NOT NULL,
     is_correct_first_try BOOLEAN DEFAULT FALSE,
     time_spent_seconds INTEGER DEFAULT 0,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_exam_mcq_attempts_student ON public.exam_mcq_practice_attempts(student_id);`,
  `CREATE INDEX IF NOT EXISTS idx_exam_mcq_attempts_session ON public.exam_mcq_practice_attempts(session_id);`,
  `CREATE INDEX IF NOT EXISTS idx_exam_mcq_attempts_question ON public.exam_mcq_practice_attempts(question_id);`,
  `CREATE INDEX IF NOT EXISTS idx_exam_mcq_attempts_created ON public.exam_mcq_practice_attempts(created_at);`,

  // --- Healthcare Licensing Exam Preparation Platform Tables ---------------
  `CREATE TABLE IF NOT EXISTS public.exam_courses (
     id VARCHAR(100) PRIMARY KEY,
     course_code VARCHAR(50) UNIQUE NOT NULL,
     course_name VARCHAR(255) NOT NULL,
     exam_authority VARCHAR(100) NOT NULL,
     profession VARCHAR(100) NOT NULL,
     country VARCHAR(100) DEFAULT 'UAE',
     description TEXT,
     thumbnail TEXT,
     status VARCHAR(50) DEFAULT 'Active',
     access_type VARCHAR(50) DEFAULT 'Free',
     created_by VARCHAR(100),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_exam_courses_authority ON public.exam_courses(exam_authority);`,
  `CREATE INDEX IF NOT EXISTS idx_exam_courses_profession ON public.exam_courses(profession);`,

  `CREATE TABLE IF NOT EXISTS public.exam_subjects (
     id VARCHAR(100) PRIMARY KEY,
     course_id VARCHAR(100) NOT NULL,
     subject_name VARCHAR(150) NOT NULL,
     description TEXT,
     status VARCHAR(50) DEFAULT 'Active',
     sort_order INTEGER DEFAULT 0,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_exam_subjects_course ON public.exam_subjects(course_id);`,

  // Additive columns for Question Bank in exam_mcq_questions
  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS question_code VARCHAR(50);`,
  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS course_id VARCHAR(100);`,
  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS subject_id VARCHAR(100);`,
  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS topic VARCHAR(150);`,
  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS detailed_explanation TEXT;`,
  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(50) DEFAULT 'Both';`,
  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';`,
  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);`,
  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);`,
  `CREATE INDEX IF NOT EXISTS idx_exam_mcq_course ON public.exam_mcq_questions(course_id);`,
  `CREATE INDEX IF NOT EXISTS idx_exam_mcq_qcode ON public.exam_mcq_questions(question_code);`,

  `CREATE TABLE IF NOT EXISTS public.exam_practice_sessions (
     id VARCHAR(100) PRIMARY KEY,
     student_id VARCHAR(100),
     student_name VARCHAR(150) NOT NULL,
     course_id VARCHAR(100),
     current_question_index INTEGER DEFAULT 0,
     completed_question_ids JSONB DEFAULT '[]'::jsonb,
     question_attempts_state JSONB DEFAULT '{}'::jsonb,
     total_time_spent INTEGER DEFAULT 0,
     last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_exam_practice_sess_student ON public.exam_practice_sessions(student_id, course_id);`,

  `CREATE TABLE IF NOT EXISTS public.exam_mock_test_attempts (
     id VARCHAR(100) PRIMARY KEY,
     student_id VARCHAR(100),
     student_name VARCHAR(150) NOT NULL,
     mock_test_id VARCHAR(100) NOT NULL,
     mock_test_name VARCHAR(255),
     course_id VARCHAR(100),
     started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     submitted_at TIMESTAMP WITH TIME ZONE,
     total_questions INTEGER DEFAULT 0,
     correct_answers INTEGER DEFAULT 0,
     wrong_answers INTEGER DEFAULT 0,
     unanswered INTEGER DEFAULT 0,
     score NUMERIC(5,2) DEFAULT 0,
     percentage NUMERIC(5,2) DEFAULT 0,
     result VARCHAR(20) DEFAULT 'FAIL',
     time_taken_seconds INTEGER DEFAULT 0,
     answers_snapshot JSONB DEFAULT '{}'::jsonb
   );`,
  `CREATE INDEX IF NOT EXISTS idx_exam_mock_att_student ON public.exam_mock_test_attempts(student_id);`,
  `CREATE INDEX IF NOT EXISTS idx_exam_mock_att_test ON public.exam_mock_test_attempts(mock_test_id);`,

  `CREATE TABLE IF NOT EXISTS public.exam_study_materials (
     id VARCHAR(100) PRIMARY KEY,
     course_id VARCHAR(100),
     subject_id VARCHAR(100),
     topic VARCHAR(150),
     title VARCHAR(255) NOT NULL,
     description TEXT,
     material_type VARCHAR(50) DEFAULT 'PDF',
     file_url TEXT,
     external_url TEXT,
     thumbnail TEXT,
     allow_download BOOLEAN DEFAULT TRUE,
     status VARCHAR(50) DEFAULT 'Active',
     uploaded_by VARCHAR(100),
     uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_exam_materials_course ON public.exam_study_materials(course_id);`,

  `CREATE TABLE IF NOT EXISTS public.exam_guidelines (
     id VARCHAR(100) PRIMARY KEY,
     course_id VARCHAR(100) NOT NULL,
     guideline_title VARCHAR(255) NOT NULL,
     section VARCHAR(100) NOT NULL,
     content TEXT NOT NULL,
     official_reference_url TEXT,
     updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     status VARCHAR(50) DEFAULT 'Active',
     created_by VARCHAR(100),
     updated_by VARCHAR(100)
   );`,
  `CREATE INDEX IF NOT EXISTS idx_exam_guidelines_course ON public.exam_guidelines(course_id);`,

  // --- marketing module foundations & serials ----------------------------------
  `CREATE TABLE IF NOT EXISTS public.marketing_contact_serials (
     id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1), 
     next_value BIGINT NOT NULL DEFAULT 1
   );`,
  `INSERT INTO public.marketing_contact_serials (id, next_value) 
   VALUES (1, 1) 
   ON CONFLICT (id) DO NOTHING;`,
  `CREATE OR REPLACE FUNCTION public.next_marketing_contact_serial() RETURNS VARCHAR LANGUAGE plpgsql AS $mkt$
   DECLARE allocated_value BIGINT;
   BEGIN
     UPDATE public.marketing_contact_serials SET next_value = next_value + 1 WHERE id = 1 RETURNING next_value - 1 INTO allocated_value;
     RETURN 'MKT-' || LPAD(allocated_value::TEXT, 8, '0');
   END;
   $mkt$;`,

  // --- marketing contacts additive columns -------------------------------------
  `ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(50) NOT NULL DEFAULT 'new';`,
  `ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS converted_lead_id VARCHAR(50);`,
  `ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;`,
  `ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS qualification_note TEXT;`,
  `ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS is_suppressed BOOLEAN NOT NULL DEFAULT FALSE;`,
  `ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS suppression_reason VARCHAR(255);`,
  `ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS suppressed_at TIMESTAMPTZ;`,

  // --- marketing consent events additive columns & indexes --------------------
  `ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);`,
  `ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS evidence_type VARCHAR(50);`,
  `ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS evidence_reference VARCHAR(255);`,
  `ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`,
  `ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);`,
  `CREATE INDEX IF NOT EXISTS marketing_consent_events_contact_occurred_idx ON public.marketing_consent_events(contact_id, recorded_at);`,
  `CREATE INDEX IF NOT EXISTS marketing_consent_events_company_occurred_idx ON public.marketing_consent_events(company_id, recorded_at);`,

  // --- marketing suppression & activities --------------------------------------
  `CREATE TABLE IF NOT EXISTS public.marketing_suppressions (
     id VARCHAR(36) PRIMARY KEY,
     contact_id VARCHAR(36) UNIQUE NOT NULL,
     reason VARCHAR(255) NOT NULL,
     recorded_by_id VARCHAR(36) NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );`,
  `CREATE TABLE IF NOT EXISTS public.marketing_contact_activities (
     id VARCHAR(36) PRIMARY KEY, 
     contact_id VARCHAR(36) NOT NULL REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
     actor_id VARCHAR(36) NOT NULL REFERENCES public.users(id), 
     type VARCHAR(60) NOT NULL, 
     note TEXT, 
     metadata JSONB,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS marketing_contact_activities_idx ON public.marketing_contact_activities(contact_id, created_at);`,

  // --- leads marketing linkage -------------------------------------------------
  `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS marketing_contact_id VARCHAR(36);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS leads_marketing_contact_id_key ON public.leads(marketing_contact_id);`
];

const SEED_STATEMENTS = [
  // `updated_at` is NOT NULL without a default on a freshly provisioned database
  // (Prisma's @updatedAt only applies to writes made through the Prisma client).
  `INSERT INTO public.lead_stages (id, key, label, description, color, order_index, is_active, is_system, company, updated_at)
   VALUES
     ('stage-new', 'new', 'New Inquiry', 'Fresh uncontacted inbound lead', 'rose', 0, TRUE, TRUE, 'ALL', NOW()),
     ('stage-assigned', 'assigned', 'Assigned', 'Lead assigned to coordinator or education counsellor', 'amber', 1, TRUE, FALSE, 'ALL', NOW()),
     ('stage-contacted', 'contacted', 'Contacted', 'Initial outreach made via WhatsApp or call', 'emerald', 2, TRUE, FALSE, 'ALL', NOW()),
     ('stage-potential', 'potential', 'Qualified prospect showing active interest', 'Lead showing active interest in a treatment or course', 'purple', 3, TRUE, FALSE, 'ALL', NOW()),
     ('stage-under-discussion', 'under_discussion', 'Under Discussion', 'Ongoing treatment / course consultation & quotation', 'sky', 4, TRUE, FALSE, 'ALL', NOW()),
     ('stage-not-relevant', 'not_relevant', 'Not Relevant Inquiry', 'Wrong inquiry or service not offered', 'slate', 5, TRUE, FALSE, 'ALL', NOW()),
     ('stage-not-eligible', 'not_eligible', 'Not Eligible', 'Client medically or academically ineligible', 'zinc', 6, TRUE, FALSE, 'ALL', NOW()),
     ('stage-converted', 'converted', 'Converted (Closed Won)', 'Patient booked appointment or student enrolled', 'teal', 7, TRUE, TRUE, 'ALL', NOW()),
     ('stage-lost', 'lost', 'Lost', 'Lead discontinued, unresponsive, or declined', 'red', 8, TRUE, TRUE, 'ALL', NOW())
   ON CONFLICT (key) DO NOTHING;`,
  `INSERT INTO public.branches (id, name, code, address, phone, is_active, created_at, updated_at)
   VALUES
     ('branch-colombo', 'Colombo (Head Office)', 'COLOMBO', 'Colombo, Sri Lanka', '+94 70 639 3353', TRUE, NOW(), NOW()),
     ('branch-maruthamunai', 'Maruthamunai Branch', 'MARUTHAMUNAI', 'Maruthamunai, Sri Lanka', '+94 70 637 3353', TRUE, NOW(), NOW())
   ON CONFLICT (code) DO NOTHING;`,
  `INSERT INTO public.rooms (id, branch_id, name, room_number, description, color, operating_start, operating_end, is_active, created_at, updated_at)
   VALUES
     ('room-col-1', 'branch-colombo', 'Consultation Suite 1', 'R-101', 'General aesthetic consultation & triage', '#0d9488', '08:00', '20:00', TRUE, NOW(), NOW()),
     ('room-col-2', 'branch-colombo', 'Laser & Skin Therapy Suite', 'R-102', 'Laser facial, carbon peel & anti-aging', '#6366f1', '08:00', '20:00', TRUE, NOW(), NOW()),
     ('room-col-3', 'branch-colombo', 'IV Wellness & Infusion Lounge', 'R-103', 'Glutathione IV drips & cellular hydration', '#ec4899', '08:00', '20:00', TRUE, NOW(), NOW()),
     ('room-col-4', 'branch-colombo', 'Hair Restoration Clinic', 'R-104', 'PRP therapy & scalp mesotherapy', '#f59e0b', '08:00', '20:00', TRUE, NOW(), NOW()),
     ('room-mar-1', 'branch-maruthamunai', 'Consultation Room A', 'M-201', 'Primary clinical assessment', '#0d9488', '08:00', '20:00', TRUE, NOW(), NOW()),
     ('room-mar-2', 'branch-maruthamunai', 'Aesthetic & IV Suite B', 'M-202', 'Clinical procedures & IV drips', '#6366f1', '08:00', '20:00', TRUE, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;`
];

const EXAM_SEED_STATEMENTS = [
  // 1. Initial Exam Categories
  `INSERT INTO public.exam_categories (id, name, code, description, icon, color, is_active, display_order, created_at, updated_at)
   VALUES
     ('cat-dha', 'DHA', 'DHA', 'Dubai Health Authority licensing exams for doctors, nurses, allied health', 'Stethoscope', '#06b6d4', TRUE, 1, NOW(), NOW()),
     ('cat-haad', 'HAAD', 'HAAD', 'Health Authority Abu Dhabi / DoH healthcare professional exams', 'PlusCircle', '#10b981', TRUE, 2, NOW(), NOW()),
     ('cat-moh', 'MOH', 'MOH', 'Ministry of Health UAE licensing exams and assessment modules', 'Activity', '#8b5cf6', TRUE, 3, NOW(), NOW()),
     ('cat-prometric', 'Prometric', 'PROMETRIC', 'Saudi Commission (SCFHS), Qatar (QCHP), Oman & Bahrain Prometric exams', 'ClipboardCheck', '#f59e0b', TRUE, 4, NOW(), NOW()),
     ('cat-nclex', 'NCLEX', 'NCLEX', 'National Council Licensure Examination for Registered Nurses (RN/PN)', 'ShieldAlert', '#ef4444', TRUE, 5, NOW(), NOW()),
     ('cat-other', 'Other Exams', 'OTHER', 'Specialized international board exams and nursing entrance credentials', 'Globe', '#64748b', TRUE, 6, NOW(), NOW())
   ON CONFLICT (id) DO NOTHING;`
];

async function runAll(prisma, statements, failures) {
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (error) {
      failures.push({ sql: sql.trim().split('\n')[0].slice(0, 90), message: error.message });
    }
  }
}

/**
 * Applies the idempotent schema delta once per process.
 * @returns {Promise<{ok: boolean, failures: Array<{sql: string, message: string}>}>}
 */
export async function ensureSchema(prisma) {
  const failures = [];
  await runAll(prisma, STATEMENTS, failures);

  const seeded = await prisma
    .$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM public.lead_stages;`)
    .catch(() => null);
  if (seeded && seeded[0] && seeded[0].count === 0) {
    await runAll(prisma, SEED_STATEMENTS, failures);
  }

  const examCatCount = await prisma
    .$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM public.exam_categories;`)
    .catch(() => null);
  if (examCatCount && examCatCount[0] && examCatCount[0].count === 0) {
    await runAll(prisma, EXAM_SEED_STATEMENTS, failures);
  }

  if (failures.length > 0) {
    console.warn(`⚠️ [Schema] ${failures.length} bootstrap statement(s) did not apply:`);
    for (const failure of failures) {
      console.warn(`   - ${failure.sql} → ${failure.message}`);
    }
  }
  return { ok: failures.length === 0, failures };
}
