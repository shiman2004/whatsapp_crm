/**
 * Provision the isolated test database.
 *
 * Safe by construction: the schema used here (`prisma/schema.test.prisma`) has a
 * HARDCODED local URL, so the Prisma CLI cannot be redirected at production by
 * `backend/.env`. That trap is real — `prisma db push` reads `backend/.env` and
 * ignores an inherited `DATABASE_URL`.
 *
 * Usage: node scripts/setup-test-db.js
 *   1. Creates the database if missing (via the `postgres` maintenance DB).
 *   2. Drops and recreates `public` so a run starts from a known-empty schema.
 *   3. `prisma db push` from the test schema.
 *   4. Applies the idempotent bootstrap via the app's own `ensureSchema`.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '..');

// Read the local test config; never fall back to backend/.env.
dotenv.config({ path: path.join(backendDir, '.env.test'), quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  console.error('TEST_DATABASE_URL is not set. Copy backend/.env.test.example to backend/.env.test first.');
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(testUrl);
} catch {
  console.error('TEST_DATABASE_URL is not a valid URL.');
  process.exit(1);
}

const dbName = parsed.pathname.replace(/^\//, '');
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) || /(^|[-_])test($|[-_])/.test(dbName);
if (!isLocal) {
  console.error(`Refusing to provision ${parsed.hostname}/${dbName}: not a local/_test database.`);
  process.exit(1);
}

// Locate psql. It is frequently installed but not on PATH on Windows, so fall back to the
// standard PostgreSQL install layout rather than failing with a bare ENOENT.
function findPsql() {
  if (process.env.PSQL_PATH) return process.env.PSQL_PATH;
  const candidates = [];
  if (process.platform === 'win32') {
    const roots = ['C:/Program Files/PostgreSQL', 'C:/Program Files (x86)/PostgreSQL'];
    for (const root of roots) {
      try {
        for (const version of fs.readdirSync(root).sort().reverse()) {
          candidates.push(`${root}/${version}/bin/psql.exe`);
        }
      } catch {
        // Not installed under this root.
      }
    }
  }
  candidates.push('psql');
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  console.error('Could not find psql. Install the PostgreSQL client tools, or set PSQL_PATH.');
  process.exit(1);
}

const psql = findPsql();
const baseEnv = { ...process.env, PGPASSWORD: parsed.password || process.env.PGPASSWORD || 'postgres' };
const psqlArgs = (database) => ['-h', parsed.hostname, '-p', parsed.port || '5432', '-U', decodeURIComponent(parsed.username || 'postgres'), '-d', database, '-v', 'ON_ERROR_STOP=1', '-c'];

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', env: baseEnv, ...opts });
}

console.log(`Provisioning isolated test database ${parsed.hostname}:${parsed.port || 5432}/${dbName}`);

// 1. Create if missing. `CREATE DATABASE` cannot run inside a transaction and has no
//    IF NOT EXISTS on older servers, so probe first.
try {
  const exists = run(psql, ['-h', parsed.hostname, '-p', parsed.port || '5432', '-U', decodeURIComponent(parsed.username || 'postgres'), '-d', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname = '${dbName}'`]).trim();
  if (exists !== '1') {
    run(psql, psqlArgs('postgres').concat(`CREATE DATABASE "${dbName}"`));
    console.log(`  created database ${dbName}`);
  } else {
    console.log(`  database ${dbName} already exists`);
  }
} catch (e) {
  console.error('Could not reach PostgreSQL with the configured credentials.');
  console.error(String(e.stderr || e.message).trim());
  process.exit(1);
}

// 2. Reset the schema so every provision is from a known state.
//    `DROP SCHEMA public CASCADE` is safe: this database is dedicated to tests.
run(psql, psqlArgs(dbName).concat('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'));
console.log('  reset public schema');

// 3. Push the Prisma schema from the hardcoded-local test schema.
execFileSync('npx', ['prisma', 'db', 'push', '--config', 'prisma/prisma.config.test.ts'], {
  cwd: backendDir,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: testUrl },
});

// 4. Apply the idempotent bootstrap (extra tables/columns/seeds) through app code, so
//    the provisioned shape matches what the server itself guarantees.
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
const db = await import('../src/db.js');
const conn = await db.checkDbConnection();
if (!conn.connected) {
  console.error('Test database is not reachable after provisioning.');
  process.exit(1);
}
const boot = await db.waitForSchemaBootstrap();
if (!boot?.ok) {
  console.error(`Schema bootstrap reported ${boot?.failures?.length ?? 'unknown'} failure(s):`);
  for (const f of boot?.failures ?? []) console.error(`  - ${f.sql} -> ${String(f.message).split('\n').pop()}`);
  process.exit(1);
}
const prisma = db.getPrisma();
const [counts] = await prisma.$queryRawUnsafe(
  `SELECT (SELECT COUNT(*)::int FROM lead_stages) AS stages, (SELECT COUNT(*)::int FROM leads) AS leads`
);
console.log(`  schema bootstrap ok; lead_stages=${counts.stages} leads=${counts.leads}`);
await prisma.$disconnect();
console.log('Test database ready.');
