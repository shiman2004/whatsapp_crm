CREATE TABLE IF NOT EXISTS public.exam_categories (
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
   );

CREATE INDEX IF NOT EXISTS idx_exam_categories_order ON public.exam_categories(display_order);

CREATE TABLE IF NOT EXISTS public.exam_materials (
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
   );

CREATE INDEX IF NOT EXISTS idx_exam_materials_cat ON public.exam_materials(category_id);

CREATE INDEX IF NOT EXISTS idx_exam_materials_type ON public.exam_materials(type);

CREATE TABLE IF NOT EXISTS public.exam_material_requests (
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
   );

CREATE INDEX IF NOT EXISTS idx_exam_requests_status ON public.exam_material_requests(status);

CREATE INDEX IF NOT EXISTS idx_exam_requests_cat ON public.exam_material_requests(category_id);

CREATE TABLE IF NOT EXISTS public.exam_mock_tests (
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
   );

CREATE INDEX IF NOT EXISTS idx_exam_mock_cat ON public.exam_mock_tests(category_id);

CREATE TABLE IF NOT EXISTS public.exam_provisions (
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
   );

CREATE INDEX IF NOT EXISTS idx_exam_provisions_cat ON public.exam_provisions(category_id);

CREATE INDEX IF NOT EXISTS idx_exam_provisions_status ON public.exam_provisions(access_status);

CREATE TABLE IF NOT EXISTS public.exam_mcq_questions (
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
   );

CREATE INDEX IF NOT EXISTS idx_exam_mcq_cat ON public.exam_mcq_questions(category_id);

CREATE INDEX IF NOT EXISTS idx_exam_mcq_active ON public.exam_mcq_questions(is_active);

CREATE INDEX IF NOT EXISTS idx_exam_mcq_order ON public.exam_mcq_questions(display_order);

CREATE TABLE IF NOT EXISTS public.exam_mcq_practice_attempts (
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
   );

CREATE INDEX IF NOT EXISTS idx_exam_mcq_attempts_student ON public.exam_mcq_practice_attempts(student_id);

CREATE INDEX IF NOT EXISTS idx_exam_mcq_attempts_session ON public.exam_mcq_practice_attempts(session_id);

CREATE INDEX IF NOT EXISTS idx_exam_mcq_attempts_question ON public.exam_mcq_practice_attempts(question_id);

CREATE INDEX IF NOT EXISTS idx_exam_mcq_attempts_created ON public.exam_mcq_practice_attempts(created_at);

CREATE TABLE IF NOT EXISTS public.exam_courses (
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
   );

CREATE INDEX IF NOT EXISTS idx_exam_courses_authority ON public.exam_courses(exam_authority);

CREATE INDEX IF NOT EXISTS idx_exam_courses_profession ON public.exam_courses(profession);

CREATE TABLE IF NOT EXISTS public.exam_subjects (
     id VARCHAR(100) PRIMARY KEY,
     course_id VARCHAR(100) NOT NULL,
     subject_name VARCHAR(150) NOT NULL,
     description TEXT,
     status VARCHAR(50) DEFAULT 'Active',
     sort_order INTEGER DEFAULT 0,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

CREATE INDEX IF NOT EXISTS idx_exam_subjects_course ON public.exam_subjects(course_id);

ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS question_code VARCHAR(50);

ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS course_id VARCHAR(100);

ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS subject_id VARCHAR(100);

ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS topic VARCHAR(150);

ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS detailed_explanation TEXT;

ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(50) DEFAULT 'Both';

ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';

ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);

ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_exam_mcq_course ON public.exam_mcq_questions(course_id);

CREATE INDEX IF NOT EXISTS idx_exam_mcq_qcode ON public.exam_mcq_questions(question_code);

CREATE TABLE IF NOT EXISTS public.exam_practice_sessions (
     id VARCHAR(100) PRIMARY KEY,
     student_id VARCHAR(100),
     student_name VARCHAR(150) NOT NULL,
     course_id VARCHAR(100),
     current_question_index INTEGER DEFAULT 0,
     completed_question_ids JSONB DEFAULT '[]'::jsonb,
     question_attempts_state JSONB DEFAULT '{}'::jsonb,
     total_time_spent INTEGER DEFAULT 0,
     last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

CREATE INDEX IF NOT EXISTS idx_exam_practice_sess_student ON public.exam_practice_sessions(student_id, course_id);

CREATE TABLE IF NOT EXISTS public.exam_mock_test_attempts (
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
   );

CREATE INDEX IF NOT EXISTS idx_exam_mock_att_student ON public.exam_mock_test_attempts(student_id);

CREATE INDEX IF NOT EXISTS idx_exam_mock_att_test ON public.exam_mock_test_attempts(mock_test_id);

CREATE TABLE IF NOT EXISTS public.exam_study_materials (
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
   );

CREATE INDEX IF NOT EXISTS idx_exam_materials_course ON public.exam_study_materials(course_id);

CREATE TABLE IF NOT EXISTS public.exam_guidelines (
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
   );

CREATE INDEX IF NOT EXISTS idx_exam_guidelines_course ON public.exam_guidelines(course_id);