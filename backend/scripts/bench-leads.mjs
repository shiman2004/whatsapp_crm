/**
 * Repeatable /api/leads payload benchmark.
 *
 * Runs the OLD and NEW include shapes back to back in the same process against the same
 * database, so the comparison is not confounded by connection temperature or load. Reports
 * median round-trip time and serialized payload size for each shape.
 *
 * Usage: node scripts/bench-leads.mjs
 */
// Operator utility, not a suite. Marked as a test run so src/db.js loads .env.test and
// the isolated-database guard accepts the target; it still refuses anything that is not
// local/_test. Override with NODE_ENV if ever run in another context.
process.env.NODE_ENV = 'test';
process.argv[1] = 'D:/Royal Project/whatsapp_crm/backend/bench-leads.mjs';

const db = await import('../src/db.js');
const conn = await db.checkDbConnection();
if (!conn.connected) {
  console.error('Database unavailable:', conn.message);
  process.exit(1);
}
await db.waitForSchemaBootstrap();
const prisma = db.getPrisma();

const OLD_INCLUDE = {
  customer: true,
  category: true,
  treatment: true,
  assignedCoordinator: true,
  whatsappSession: true,
  notes: true,
  stageHistories: true,
  assignmentHistories: { orderBy: { assignedAt: 'desc' } },
  _count: { select: { messages: true } }
};

const NEW_INCLUDE = {
  customer: true,
  category: true,
  treatment: true,
  assignedCoordinator: true,
  whatsappSession: true,
  assignmentHistories: { orderBy: { assignedAt: 'desc' }, take: 1 },
  _count: { select: { messages: true, notes: true } }
};

const PAGE_SIZE = 50;
const RUNS = 15;

// OLD and NEW are measured in an interleaved sequence. Running one shape fully before the
// other lets cache state and background load differ between them, which on this host can
// swing a measurement by more than the effect being measured. Interleaving makes every
// run of each shape see (on average) the same conditions.
async function measureAll(include) {
  const t0 = performance.now();
  const leads = await prisma.lead.findMany({
    where: {},
    include,
    orderBy: { updatedAt: 'desc' },
    take: PAGE_SIZE
  });
  return {
    ms: performance.now() - t0,
    rows: leads.length,
    bytes: Buffer.byteLength(JSON.stringify(leads))
  };
}

// Warm-up, so the first iteration does not pay one-off connection setup.
await measureAll(OLD_INCLUDE);
await measureAll(NEW_INCLUDE);

const oldTimes = [];
const newTimes = [];
let oldBytes = 0;
let newBytes = 0;
let rows = 0;

for (let i = 0; i < RUNS; i++) {
  // Alternate which shape goes first so neither systematically benefits from a warmer cache.
  const first = i % 2 === 0 ? [OLD_INCLUDE, oldTimes] : [NEW_INCLUDE, newTimes];
  const second = i % 2 === 0 ? [NEW_INCLUDE, newTimes] : [OLD_INCLUDE, oldTimes];
  const a = await measureAll(first[0]);
  first[1].push(a.ms);
  const b = await measureAll(second[0]);
  second[1].push(b.ms);
  rows = a.rows;
  oldBytes = OLD_INCLUDE === first[0] ? a.bytes : b.bytes;
  newBytes = NEW_INCLUDE === first[0] ? a.bytes : b.bytes;
}

const median = (arr) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)];
const p25 = (arr) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length * 0.25)];
const p75 = (arr) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length * 0.75)];

const leadCount = await prisma.lead.count();
console.log(`Dataset: ${leadCount} leads, page size ${PAGE_SIZE}, ${RUNS} interleaved runs each\n`);

for (const [label, times, bytes] of [
  ['OLD (unbounded relations)', oldTimes, oldBytes],
  ['NEW (bounded relations)', newTimes, newBytes]
]) {
  console.log(
    `${label.padEnd(28)} median ${median(times).toFixed(0).padStart(5)} ms  ` +
    `p25-p75 ${p25(times).toFixed(0)}-${p75(times).toFixed(0)} ms  ` +
    `rows ${rows}  payload ${(bytes / 1024).toFixed(1)} KiB`
  );
}

// Median of the per-pair difference is more robust than comparing two separate medians.
const deltas = oldTimes.map((t, i) => t - newTimes[i]).sort((a, b) => a - b);
console.log(`\nMedian paired saving: ${median(deltas).toFixed(0)} ms   payload ${(100 - (newBytes / oldBytes) * 100).toFixed(1)}% smaller`);

await prisma.$disconnect();
setTimeout(() => process.exit(0), 200).unref();
