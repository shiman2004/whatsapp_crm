import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

let prismaInstance = null;
let isDbConnected = false;

export const getPrisma = () => {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!prismaInstance) {
    try {
      prismaInstance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      });
    } catch (e) {
      console.warn('⚠️ PrismaClient initialization deferred:', e.message);
      return null;
    }
  }
  return prismaInstance;
};

// Check if MySQL Database is reachable
export const checkDbConnection = async () => {
  const prisma = getPrisma();
  if (!prisma) {
    isDbConnected = false;
    return { connected: false, message: 'DATABASE_URL not configured in backend/.env' };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    isDbConnected = true;
    console.log('✅ Connected to Supabase Cloud Database successfully via Prisma!');
    
    // Ensure leads table columns allow NULL when no treatment is selected
    await prisma.$executeRawUnsafe(`ALTER TABLE "leads" ALTER COLUMN "categoryId" DROP NOT NULL;`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TABLE "leads" ALTER COLUMN "treatmentId" DROP NOT NULL;`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "serialNumber" VARCHAR(50);`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "source" VARCHAR(50) DEFAULT 'RWC';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "company" VARCHAR(50) DEFAULT 'RWC';`).catch(() => null);
    // NOTE: Postgres prepared statements allow only ONE command per call,
    // so each DDL/DML statement must be sent separately.
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.company_lead_serials (
        company VARCHAR(10) PRIMARY KEY,
        next_value INTEGER NOT NULL DEFAULT 1
      );
    `).catch((err) => console.warn('⚠️ company_lead_serials table provisioning skipped:', err.message));
    await prisma.$executeRawUnsafe(`
      INSERT INTO public.company_lead_serials (company, next_value)
      VALUES ('RWC', 1), ('CRAS', 1)
      ON CONFLICT (company) DO NOTHING;
    `).catch((err) => console.warn('⚠️ company_lead_serials seed skipped:', err.message));
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION public.next_company_lead_serial(company_code VARCHAR)
      RETURNS VARCHAR LANGUAGE plpgsql AS $serial$
      DECLARE normalized_company VARCHAR(10) := CASE WHEN upper(company_code) = 'CRAS' THEN 'CRAS' ELSE 'RWC' END;
      allocated_value INTEGER;
      BEGIN
        INSERT INTO public.company_lead_serials (company, next_value) VALUES (normalized_company, 1) ON CONFLICT (company) DO NOTHING;
        UPDATE public.company_lead_serials SET next_value = next_value + 1 WHERE company = normalized_company RETURNING next_value - 1 INTO allocated_value;
        RETURN normalized_company || '-' || lpad(allocated_value::text, 4, '0');
      END;
      $serial$;
    `).catch((err) => console.warn('⚠️ next_company_lead_serial() provisioning skipped:', err.message));

    // Ensure media_files table exists for persistent image/audio storage
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.media_files (
        id VARCHAR(255) PRIMARY KEY,
        file_name VARCHAR(255) UNIQUE NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        data BYTEA NOT NULL,
        size INT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_media_files_name ON public.media_files(file_name);`).catch(() => null);

    // Shared authentication throttling state. The primary key makes updates
    // atomic across backend instances and survives process restarts.
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
        rate_key VARCHAR(512) PRIMARY KEY,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        first_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        locked_until TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `).catch((err) => console.warn('Shared auth rate limiter unavailable:', err.message));
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_expiry ON public.auth_rate_limits(locked_until, updated_at);`).catch(() => null);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.security_audit_events (
        id VARCHAR(50) PRIMARY KEY,
        correlation_id VARCHAR(100) NOT NULL,
        actor_id VARCHAR(100),
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(255) NOT NULL,
        outcome VARCHAR(40) NOT NULL,
        metadata TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `).catch((err) => console.warn('Security audit table unavailable:', err.message));
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_security_audit_created ON public.security_audit_events(created_at DESC);`).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_security_audit_actor ON public.security_audit_events(actor_id, created_at DESC);`).catch(() => null);

    // Ensure team_broadcasts table exists for staff announcements & multimedia broadcasts
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.team_broadcasts (
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
      );
    `).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON public.team_broadcasts(created_at DESC);`).catch(() => null);

    // Ensure message_audits table exists for permanent Super Admin sender audit trail
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.message_audits (
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
      );
    `).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_message_audits_lead ON public.message_audits(lead_id);`).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_message_audits_sender ON public.message_audits(sender_id);`).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_message_audits_sent ON public.message_audits(sent_at DESC);`).catch(() => null);

    // Ensure messages table has sender audit columns (supports both Prisma default camelCase and snake_case)
    await prisma.$executeRawUnsafe(`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "senderName" VARCHAR(255);`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "senderRole" VARCHAR(50);`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "messageSource" VARCHAR(50) DEFAULT 'CRM User';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();`).catch(() => null);

    await prisma.$executeRawUnsafe(`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255);`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS sender_role VARCHAR(50);`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS message_source VARCHAR(50) DEFAULT 'CRM User';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`).catch(() => null);

    // Ensure LeadStage enum has all required values in Postgres
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'new';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'assigned';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'contacted';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'potential';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'under_discussion';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'not_relevant';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'not_eligible';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'converted';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'lost';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'interested';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'follow_up';`).catch(() => null);

    // Ensure system_settings table exists for persistent global configuration (Meta Cloud API token, etc.)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `).catch(() => null);

    // Ensure treatments table has code and company columns for CRAS courses & RWC treatments
    await prisma.$executeRawUnsafe(`ALTER TABLE "treatments" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50);`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TABLE "treatments" ADD COLUMN IF NOT EXISTS "company" VARCHAR(50) DEFAULT 'RWC';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TABLE "treatments" ADD COLUMN IF NOT EXISTS "active" BOOLEAN DEFAULT TRUE;`).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_treatments_company ON "treatments"("company");`).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_treatments_code ON "treatments"("code");`).catch(() => null);

    // Ensure lead_stages table exists for dynamic Lead Stages management
    await prisma.$executeRawUnsafe(`
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
    `).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_lead_stages_order ON public.lead_stages(order_index ASC);`).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_lead_stages_active ON public.lead_stages(is_active);`).catch(() => null);

    // Seed default lead stages if table is empty
    const stageCountResult = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM public.lead_stages;`).catch(() => [{ count: 0 }]);
    const currentStageCount = stageCountResult[0]?.count || 0;
    if (currentStageCount === 0) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO public.lead_stages (id, key, label, description, color, order_index, is_active, is_system, company)
        VALUES
          ('stage-new', 'new', 'New Inquiry', 'Fresh uncontacted inbound lead', 'rose', 0, TRUE, TRUE, 'ALL'),
          ('stage-assigned', 'assigned', 'Assigned', 'Lead assigned to coordinator or education counsellor', 'amber', 1, TRUE, FALSE, 'ALL'),
          ('stage-contacted', 'contacted', 'Contacted', 'Initial outreach made via WhatsApp or call', 'emerald', 2, TRUE, FALSE, 'ALL'),
          ('stage-potential', 'potential', 'Potential', 'Qualified prospect showing active interest', 'purple', 3, TRUE, FALSE, 'ALL'),
          ('stage-under-discussion', 'under_discussion', 'Under Discussion', 'Ongoing treatment / course consultation & quotation', 'sky', 4, TRUE, FALSE, 'ALL'),
          ('stage-not-relevant', 'not_relevant', 'Not Relevant Inquiry', 'Wrong inquiry or service not offered', 'slate', 5, TRUE, FALSE, 'ALL'),
          ('stage-not-eligible', 'not_eligible', 'Not Eligible', 'Client medically or academically ineligible', 'zinc', 6, TRUE, FALSE, 'ALL'),
          ('stage-converted', 'converted', 'Converted (Closed Won)', 'Patient booked appointment or student enrolled', 'teal', 7, TRUE, TRUE, 'ALL'),
          ('stage-lost', 'lost', 'Lost', 'Lead discontinued, unresponsive, or declined', 'red', 8, TRUE, TRUE, 'ALL')
        ON CONFLICT (key) DO NOTHING;
      `).catch(() => null);
    }

    // Provision Appointment Booking & Room Scheduling Tables
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.branches (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        address TEXT,
        phone VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `).catch(() => null);

    // Seed default branches if empty
    await prisma.$executeRawUnsafe(`
      INSERT INTO public.branches (id, name, code, address, phone, is_active)
      VALUES
        ('branch-colombo', 'Colombo (Head Office)', 'COLOMBO', 'Colombo, Sri Lanka', '+94 70 639 3353', TRUE),
        ('branch-maruthamunai', 'Maruthamunai Branch', 'MARUTHAMUNAI', 'Maruthamunai, Sri Lanka', '+94 70 637 3353', TRUE)
      ON CONFLICT (code) DO NOTHING;
    `).catch(() => null);

    // Provision Rooms Table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.rooms (
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
      );
    `).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_rooms_branch ON public.rooms(branch_id);`).catch(() => null);

    // Provision dedicated doctors / consultants table. Appointment doctors are
    // intentionally kept separate from CRM users/coordinators.
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.doctors (
        id VARCHAR(50) PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        branch VARCHAR(100),
        phone VARCHAR(50),
        avatar VARCHAR(500),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `).catch((err) => console.warn('⚠️ Doctors table provisioning skipped:', err.message));
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_doctors_branch ON public.doctors(branch);`).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_doctors_active ON public.doctors(is_active);`).catch(() => null);

    // Seed initial clinical rooms if empty
    const roomCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM public.rooms;`).catch(() => [{ count: 0 }]);
    if ((roomCount[0]?.count || 0) === 0) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO public.rooms (id, branch_id, name, room_number, description, color, operating_start, operating_end, is_active)
        VALUES
          ('room-col-1', 'branch-colombo', 'Consultation Suite 1', 'R-101', 'General aesthetic consultation & triage', '#0d9488', '08:00', '20:00', TRUE),
          ('room-col-2', 'branch-colombo', 'Laser & Skin Therapy Suite', 'R-102', 'Laser facial, carbon peel & anti-aging', '#6366f1', '08:00', '20:00', TRUE),
          ('room-col-3', 'branch-colombo', 'IV Wellness & Infusion Lounge', 'R-103', 'Glutathione IV drips & cellular hydration', '#ec4899', '08:00', '20:00', TRUE),
          ('room-col-4', 'branch-colombo', 'Hair Restoration Clinic', 'R-104', 'PRP therapy & scalp mesotherapy', '#f59e0b', '08:00', '20:00', TRUE),
          ('room-mar-1', 'branch-maruthamunai', 'Consultation Room A', 'M-201', 'Primary clinical assessment', '#0d9488', '08:00', '20:00', TRUE),
          ('room-mar-2', 'branch-maruthamunai', 'Aesthetic & IV Suite B', 'M-202', 'Clinical procedures & IV drips', '#6366f1', '08:00', '20:00', TRUE)
        ON CONFLICT (id) DO NOTHING;
      `).catch(() => null);
    }

    // Provision Room Treatments junction table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.room_treatments (
        room_id VARCHAR(50) NOT NULL,
        treatment_id VARCHAR(50) NOT NULL,
        PRIMARY KEY (room_id, treatment_id)
      );
    `).catch(() => null);

    // Provision Appointments Table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.appointments (
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
      );
    `).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_appointments_branch_time ON public.appointments(branch_id, start_time);`).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_appointments_room_time ON public.appointments(room_id, start_time, end_time);`).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_appointments_doctor_time ON public.appointments(doctor_id, start_time, end_time);`).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);`).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);`).catch(() => null);

    // Provision Appointment Status History Table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.appointment_status_history (
        id VARCHAR(50) PRIMARY KEY,
        appointment_id VARCHAR(50) NOT NULL,
        previous_status VARCHAR(50),
        new_status VARCHAR(50) NOT NULL,
        changed_by_id VARCHAR(50),
        changed_by_name VARCHAR(255),
        reason TEXT,
        changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_appt_hist_appointment ON public.appointment_status_history(appointment_id);`).catch(() => null);

    // Provision Availability Blocks Table (maintenance / doctor leave)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.availability_blocks (
        id VARCHAR(50) PRIMARY KEY,
        branch_id VARCHAR(50) NOT NULL,
        room_id VARCHAR(50),
        doctor_id VARCHAR(50),
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        reason VARCHAR(255) NOT NULL,
        created_by_id VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `).catch(() => null);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_avail_blocks_branch ON public.availability_blocks(branch_id, start_time, end_time);`).catch(() => null);

    return { connected: true, message: 'Supabase Postgres Connected' };
  } catch (err) {
    isDbConnected = false;
    console.warn('⚠️ Cloud Database connection check failed (fallback to in-memory/SSE mode):', err.message);
    return { connected: false, error: err.message };
  }
};

export const getDbStatus = () => isDbConnected;

export const allocateCompanyLeadSerial = async (prisma, company) => {
  const companyCode = String(company || 'RWC').toUpperCase() === 'CRAS' ? 'CRAS' : 'RWC';
  const result = await prisma.$queryRawUnsafe(`SELECT public.next_company_lead_serial($1) AS "serialNumber"`, companyCode);
  return result?.[0]?.serialNumber || `${companyCode}-${Date.now()}`;
};

export const getSystemSetting = async (key) => {
  const prisma = getPrisma();
  if (!prisma || !isDbConnected) return null;
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT value FROM public.system_settings WHERE key = $1 LIMIT 1;`, key);
    return rows && rows.length > 0 ? rows[0].value : null;
  } catch (e) {
    return null;
  }
};

export const setSystemSetting = async (key, value) => {
  const prisma = getPrisma();
  if (!prisma || !isDbConnected) return false;
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO public.system_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    `, key, value);
    return true;
  } catch (e) {
    console.warn(`Failed to persist system setting "${key}":`, e.message);
    return false;
  }
};
