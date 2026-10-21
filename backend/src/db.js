import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { ensureSchema } from './schemaBootstrap.js';
import { assertIsolatedTestDatabase, isTestRun } from './testDbGuard.js';

dotenv.config();
// A `.env.test` (when present) supplies the isolated test database and overrides the
// production values loaded above. Never commit a real file — see .env.test.example.
// Detection uses the entry-script path, not NODE_ENV: ESM hoists static imports, so a
// suite's own `process.env.NODE_ENV = 'test'` has not run yet when this module loads.
if (isTestRun()) {
  process.env.NODE_ENV = 'test';
  dotenv.config({ path: '.env.test', override: true, quiet: true });
  // Fail fast, before any client is constructed, if the resolved target is production.
  assertIsolatedTestDatabase();
}

let prismaInstance = null;
let isDbConnected = false;
// The correctness-critical DDL is idempotent, but it must not re-run on every
// health check or request. It runs once per process on first successful connect.
let schemaEnsured = false;
// Resolves when the background schema bootstrap finishes, so tests and callers that
// genuinely need the delta applied can wait for it instead of racing it.
let schemaBootstrapPromise = null;

export const waitForSchemaBootstrap = () => schemaBootstrapPromise || Promise.resolve();

export const getPrisma = () => {
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  if (!prismaInstance) {
    try {
      prismaInstance = new PrismaClient({
        // The pooled endpoint can be unavailable to long-running local workers.
        // Use the configured direct URL for runtime queries when it is present;
        // testDbGuard promotes the isolated test URL into both variables first.
        datasources: { db: { url: databaseUrl } },
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

    // Apply the idempotent schema delta once per process. Defined in
    // schemaBootstrap.js; failures are reported rather than silently swallowed.
    // It runs in the background because the delta is ~80 sequential DDL round-trips
    // (~50s against a remote database) and must not block startup or health checks.
    if (!schemaEnsured) {
      schemaEnsured = true;
      schemaBootstrapPromise = ensureSchema(prisma).catch((error) => {
        console.warn('⚠️ [Schema] bootstrap failed:', error.message);
        return { ok: false, failures: [{ sql: '(bootstrap)', message: error.message }] };
      });
    }

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
  const serial = result?.[0]?.serialNumber;
  // A timestamp fallback would bypass the company sequence and collide with the unique
  // index. Fail instead, so the caller can retry or surface a real error.
  if (!serial) throw new Error('next_company_lead_serial() returned no serial number');
  return serial;
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
