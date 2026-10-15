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

    return { connected: true, message: 'Supabase Postgres Connected' };
  } catch (err) {
    isDbConnected = false;
    console.warn('⚠️ Cloud Database connection check failed (fallback to in-memory/SSE mode):', err.message);
    return { connected: false, error: err.message };
  }
};

export const getDbStatus = () => isDbConnected;

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
