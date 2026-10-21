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
   DECLARE normalized_company VARCHAR(10) := CASE WHEN upper(company_code) = 'CRAS' THEN 'CRAS' ELSE 'RWC' END;
   allocated_value INTEGER;
   BEGIN
     INSERT INTO public.company_lead_serials (company, next_value) VALUES (normalized_company, 1) ON CONFLICT (company) DO NOTHING;
     UPDATE public.company_lead_serials SET next_value = next_value + 1 WHERE company = normalized_company RETURNING next_value - 1 INTO allocated_value;
     RETURN normalized_company || '-' || lpad(allocated_value::text, 4, '0');
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
  `CREATE INDEX IF NOT EXISTS idx_avail_blocks_branch ON public.availability_blocks(branch_id, start_time, end_time);`
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

  if (failures.length > 0) {
    console.warn(`⚠️ [Schema] ${failures.length} bootstrap statement(s) did not apply:`);
    for (const failure of failures) {
      console.warn(`   - ${failure.sql} → ${failure.message}`);
    }
  }
  return { ok: failures.length === 0, failures };
}
