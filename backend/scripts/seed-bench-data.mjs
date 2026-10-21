/**
 * Seed a realistic synthetic dataset into the ISOLATED TEST DATABASE so lead-query
 * performance can be measured on non-trivial data.
 *
 * Refuses to run against anything that is not a local/_test database (same rules as the
 * test-DB guard). Rows are tagged with a `bench-` prefix so they can be removed again.
 *
 * Usage: node scripts/seed-bench-data.mjs [leadCount]
 *        node scripts/seed-bench-data.mjs --clear
 */
// Operator utility, not a suite. Marked as a test run so src/db.js loads .env.test and
// the isolated-database guard accepts the target; it still refuses anything that is not
// local/_test.
process.env.NODE_ENV = 'test';
process.argv[1] = 'D:/Royal Project/whatsapp_crm/backend/seed-bench.mjs';

const db = await import('../src/db.js');
const conn = await db.checkDbConnection();
if (!conn.connected) {
  console.error('Database unavailable:', conn.message);
  process.exit(1);
}
await db.waitForSchemaBootstrap();
const prisma = db.getPrisma();

const target = process.env.DATABASE_URL || '';
try {
  const parsed = new URL(target);
  const name = parsed.pathname.replace(/^\//, '');
  const safe = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) || /(^|[-_])test($|[-_])/.test(name);
  if (!safe) {
    console.error(`Refusing to seed ${parsed.hostname}/${name}: not a local/_test database.`);
    process.exit(1);
  }
} catch {
  console.error('DATABASE_URL is not a valid URL.');
  process.exit(1);
}

const clear = process.argv.includes('--clear');
const LEAD_COUNT = Number(process.argv.find((a) => /^\d+$/.test(a))) || 300;

async function clearBenchRows() {
  // Children first, then the parent rows.
  await prisma.$executeRawUnsafe(`DELETE FROM lead_notes WHERE id LIKE 'bench-note-%'`);
  await prisma.$executeRawUnsafe(`DELETE FROM lead_stage_histories WHERE id LIKE 'bench-hist-%'`);
  await prisma.$executeRawUnsafe(`DELETE FROM lead_assignment_histories WHERE id LIKE 'bench-asg-%'`);
  await prisma.$executeRawUnsafe(`DELETE FROM messages WHERE id LIKE 'bench-msg-%'`);
  await prisma.$executeRawUnsafe(`DELETE FROM leads WHERE id LIKE 'bench-lead-%'`);
  await prisma.$executeRawUnsafe(`DELETE FROM customers WHERE id LIKE 'bench-cust-%'`);
  await prisma.$executeRawUnsafe(`DELETE FROM users WHERE id LIKE 'bench-user-%'`);
}

if (clear) {
  await clearBenchRows();
  console.log('Benchmark rows removed.');
  await prisma.$disconnect();
  setTimeout(() => process.exit(0), 200).unref();
} else {
  await clearBenchRows();

  // Deterministic ids: no random data, so runs are reproducible.
  const customers = Array.from({ length: LEAD_COUNT }, (_, i) => ({
    id: `bench-cust-${String(i).padStart(5, '0')}`,
    whatsappNumber: `+9477${String(1000000 + i).slice(-7)}`,
    whatsappId: `9477${String(1000000 + i).slice(-7)}`,
    displayName: `Benchmark Customer ${i}`,
    preferredLanguage: 'en'
  }));

  await prisma.customer.createMany({ data: customers, skipDuplicates: true });

  const leads = customers.map((c, i) => ({
    id: `bench-lead-${String(i).padStart(5, '0')}`,
    customerId: c.id,
    stage: 'contacted',
    source: 'RWC',
    company: 'RWC',
    // Half the leads are "hot" so ordering has something to sort on.
    lastCustomerMessageAt: new Date(Date.now() - i * 60_000)
  }));
  await prisma.lead.createMany({ data: leads, skipDuplicates: true });

  await prisma.message.createMany({
    data: leads.flatMap((l) => [0, 1].map((k) => ({
      id: `bench-msg-${l.id.slice(11)}-${k}`,
      leadId: l.id,
      customerId: l.customerId,
      direction: k === 0 ? 'inbound' : 'outbound',
      senderType: k === 0 ? 'customer' : 'coordinator',
      content: `Benchmark message ${k}`,
      status: 'delivered'
    }))),
    skipDuplicates: true
  });

  // Notes are the point of the benchmark: the old query loaded every one of them.
  // LeadNote and LeadStageHistory have a required FK to User, so a bench author row is
  // created first and removed with the rest of the benchmark data.
  await prisma.user.createMany({
    data: [{
      id: 'bench-user-1',
      fullName: 'Benchmark Author',
      email: 'bench-author@test.royalwellness.lk',
      role: 'coordinator',
      active: true
    }],
    skipDuplicates: true
  });

  await prisma.leadNote.createMany({
    data: leads.flatMap((l) => [0, 1, 2, 3].map((k) => ({
      id: `bench-note-${l.id.slice(11)}-${k}`,
      leadId: l.id,
      authorId: 'bench-user-1',
      authorName: 'Benchmark',
      note: `Benchmark note ${k} for ${l.id}`
    }))),
    skipDuplicates: true
  });

  await prisma.leadAssignmentHistory.createMany({
    data: leads.flatMap((l) => [0, 1, 2, 3].map((k) => ({
      id: `bench-asg-${l.id.slice(11)}-${k}`,
      leadId: l.id,
      assignedToId: 'bench-user-1',
      assignedToName: 'Benchmark',
      assignedByName: 'Benchmark'
    }))),
    skipDuplicates: true
  });

  await prisma.leadStageHistory.createMany({
    data: leads.flatMap((l) => [0, 1, 2].map((k) => ({
      id: `bench-hist-${l.id.slice(11)}-${k}`,
      leadId: l.id,
      fromStage: 'new',
      toStage: 'contacted',
      changedById: 'bench-user-1',
      changedByName: 'Benchmark'
    }))),
    skipDuplicates: true
  });

  const counts = await prisma.$queryRawUnsafe(
    `SELECT (SELECT COUNT(*)::int FROM leads) AS leads,
            (SELECT COUNT(*)::int FROM lead_notes) AS notes,
            (SELECT COUNT(*)::int FROM lead_assignment_histories) AS assignments`
  );
  console.log(`Seeded ${LEAD_COUNT} leads. Totals: ${JSON.stringify(counts[0])}`);
  await prisma.$disconnect();
  setTimeout(() => process.exit(0), 200).unref();
}
