import assert from 'node:assert';
import { getPrisma, checkDbConnection, waitForSchemaBootstrap } from './src/db.js';
import { ExamStore } from './src/examStore.js';
import { ExamOperations } from './src/examOperations.js';
import { checkExamMonitor, getExamMonitorStatus } from './src/examMonitor.js';
import { ensureSchema } from './src/schemaBootstrap.js';

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ❌ ${name}\n     ${error.message}`);
  }
}

console.log('\n📦 SECTION 1: Database Schema & Bootstrap Verification');

await check('1.1 PostgreSQL connection and schema bootstrap initialize exam_ops tables', async () => {
  const conn = await checkDbConnection();
  assert(conn.connected, 'Database must be reachable');

  const boot = await waitForSchemaBootstrap();
  assert(boot?.ok !== false, 'Schema bootstrap must succeed');

  const prisma = getPrisma();
  assert(prisma, 'Prisma client must be initialized');

  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN ('exam_ops_records', 'exam_ops_audit')
    ORDER BY table_name;
  `);
  const names = tables.map(t => t.table_name);
  assert(names.includes('exam_ops_records'), 'exam_ops_records must exist');
  assert(names.includes('exam_ops_audit'), 'exam_ops_audit must exist');
});

await check('1.2 Canonical table structure and columns of public.exam_ops_records match specification', async () => {
  const prisma = getPrisma();
  const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'exam_ops_records'
    ORDER BY ordinal_position;
  `);

  const colMap = Object.fromEntries(columns.map(c => [c.column_name, c]));
  assert.strictEqual(colMap.kind?.data_type, 'text');
  assert.strictEqual(colMap.kind?.is_nullable, 'NO');
  assert.strictEqual(colMap.id?.data_type, 'text');
  assert.strictEqual(colMap.id?.is_nullable, 'NO');
  assert.strictEqual(colMap.data?.data_type, 'jsonb');
  assert.strictEqual(colMap.data?.is_nullable, 'NO');
  assert.strictEqual(colMap.revision?.data_type, 'integer');
  assert.strictEqual(colMap.revision?.is_nullable, 'NO');
  assert(colMap.created_at?.data_type.includes('timestamp'));
  assert(colMap.updated_at?.data_type.includes('timestamp'));
});

await check('1.3 Required functional indexes on exam_ops_records exist', async () => {
  const prisma = getPrisma();
  const idxs = await prisma.$queryRawUnsafe(`
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' AND tablename = 'exam_ops_records';
  `);
  const idxNames = idxs.map(i => i.indexname);
  assert(idxNames.includes('exam_ops_records_pkey'), 'Primary key index must exist');
  assert(idxNames.includes('exam_ops_owner_idx'), 'exam_ops_owner_idx must exist');
  assert(idxNames.includes('exam_ops_email_idx'), 'exam_ops_email_idx must exist');
  assert(idxNames.includes('exam_ops_status_idx'), 'exam_ops_status_idx must exist');
});

console.log('\n📦 SECTION 2: ExamStore Durable Transactions on PostgreSQL');

await check('2.1 ExamStore put, get, list and audit operations execute against PostgreSQL', async () => {
  const prisma = getPrisma();
  const store = new ExamStore(prisma);
  const testId = `req-test-${Date.now()}`;

  // 1. Put
  const saved = await store.transaction(async tx => {
    return tx.put('test-requirement', testId, {
      number: 'REQ-1001',
      ownerId: 'test-officer-1',
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString()
    });
  });
  assert(saved, 'Record must be saved');
  assert.strictEqual(saved.revision, 1);

  // 2. Get
  const fetched = await store.transaction(async tx => tx.get('test-requirement', testId));
  assert(fetched, 'Record must be retrieved');
  assert.strictEqual(fetched.number, 'REQ-1001');
  assert.strictEqual(fetched.ownerId, 'test-officer-1');
  assert.strictEqual(fetched.revision, 1);

  // 3. List
  const list = await store.transaction(async tx => tx.list('test-requirement', 'test-officer-1'));
  assert(list.some(r => r.number === 'REQ-1001'), 'List must include inserted record');

  // 4. Audit
  await store.transaction(async tx => {
    await tx.audit('tester-admin', 'CREATE', testId, { note: 'integration test' });
  });

  const auditRows = await prisma.$queryRawUnsafe(`
    SELECT actor_id, action, target 
    FROM public.exam_ops_audit 
    WHERE target = $1;
  `, testId);
  assert(auditRows.length >= 1, 'Audit record must be persisted in exam_ops_audit');
  assert.strictEqual(auditRows[0].action, 'CREATE');

  // Clean up test record
  await prisma.$executeRawUnsafe('DELETE FROM public.exam_ops_records WHERE kind = $1 AND id = $2;', 'test-requirement', testId);
  await prisma.$executeRawUnsafe('DELETE FROM public.exam_ops_audit WHERE target = $1;', testId);
});

console.log('\n📦 SECTION 3: ExamOperations & ExamMonitor Health Check');

await check('3.1 ExamOperations.health() succeeds with connected storage status', async () => {
  const prisma = getPrisma();
  const service = new ExamOperations(new ExamStore(prisma));
  const health = await service.health({ id: 'system:exam-monitor', role: 'super_admin' });
  assert.strictEqual(health.storage, 'connected', 'Storage status must be connected');
  assert(Array.isArray(health.issues), 'Issues must be an array');
});

await check('3.2 checkExamMonitor() updates state to CHECKED without 42P01 error', async () => {
  await checkExamMonitor();
  const status = getExamMonitorStatus();
  assert.strictEqual(status.status, 'CHECKED', 'Monitor status must be CHECKED');
  assert(status.result, 'Monitor result must be populated');
  assert.strictEqual(status.result.storage, 'connected');
});

console.log('\n📦 SECTION 4: Idempotency & CRM Isolation');

await check('4.1 Re-running ensureSchema() is completely idempotent and preserves records', async () => {
  const prisma = getPrisma();
  const res = await ensureSchema(prisma);
  assert(res.ok !== false, 'Re-running ensureSchema must not fail');

  // Verify other CRM tables remain intact
  const stages = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM public.lead_stages;');
  assert(stages[0].count > 0, 'Lead stages must remain populated');

  const branches = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM public.branches;');
  assert(branches[0].count > 0, 'Branches must remain populated');
});

console.log(`\n============================================================`);
console.log(`Exam Operations Database checks: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
} else {
  await getPrisma()?.$disconnect();
}
