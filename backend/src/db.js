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

    // Ensure LeadStage enum has all required values in Postgres
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'potential';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'under_discussion';`).catch(() => null);
    await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'not_relevant';`).catch(() => null);

    return { connected: true, message: 'Supabase Postgres Connected' };
  } catch (err) {
    isDbConnected = false;
    console.warn('⚠️ Cloud Database connection check failed (fallback to in-memory/SSE mode):', err.message);
    return { connected: false, error: err.message };
  }
};

export const getDbStatus = () => isDbConnected;
