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

    // Ensure messages table has sender audit columns
    await prisma.$executeRawUnsafe(`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "senderName" VARCHAR(255);`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "senderRole" VARCHAR(50);`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "messageSource" VARCHAR(50) DEFAULT 'CRM User';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();`).catch(() => null);

    // Ensure LeadStage enum has all required values in Postgres
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'new';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'assigned';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'contacted';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'potential';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'under_discussion';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'not_relevant';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'converted';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'lost';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'interested';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'follow_up';`).catch(() => null);

    return { connected: true, message: 'Supabase Postgres Connected' };
  } catch (err) {
    isDbConnected = false;
    console.warn('⚠️ Cloud Database connection check failed (fallback to in-memory/SSE mode):', err.message);
    return { connected: false, error: err.message };
  }
};

export const getDbStatus = () => isDbConnected;
