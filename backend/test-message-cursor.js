// Regression test for /api/messages cursor pagination.
//
// The cursor used to be a bare timestamp (`timestamp < cursor`). Timestamps are not
// unique: a webhook burst or bulk import writes many messages within the same
// millisecond. A strict `<` comparison then drops EVERY remaining message that shares
// that millisecond, so paging silently lost rows. The cursor is now `timestamp|id`.
//
// The fixture deliberately writes several messages with the SAME timestamp, so this test
// fails against the old implementation and passes against the fix. Rows are owned by this
// suite and removed in cleanup.
process.env.NODE_ENV = 'test';

import assert from 'assert';
import { server, signAuthToken } from './server.js';
import { checkDbConnection, getPrisma } from './src/db.js';

const PORT = 39493;
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(PORT, '127.0.0.1', resolve);
});
const base = `http://127.0.0.1:${PORT}`;

const db = await checkDbConnection();
if (!db.connected) {
  console.log('\n⏭️  SKIPPED: live database unavailable — message cursor tests not executed.');
  await new Promise((r) => server.close(r));
  server.closeAllConnections?.();
  process.exit(0);
}

const prisma = getPrisma();
const token = signAuthToken({ userId: 'user-admin-1', email: 'admin@example.test', role: 'super_admin', fullName: 'Test Admin' });

const LEAD_ID = 'test-cursor-lead';
const CUSTOMER_ID = 'test-cursor-customer';
const PREFIX = 'test-cursor-msg-';
// 25 messages, but only 5 distinct timestamps: 5 messages share each instant.
const MESSAGE_COUNT = 25;
const DISTINCT_TIMES = 5;

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✅ ${name}`);
}

async function get(path) {
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function cleanup() {
  await prisma.message.deleteMany({ where: { id: { startsWith: PREFIX } } }).catch(() => {});
  await prisma.lead.delete({ where: { id: LEAD_ID } }).catch(() => {});
  await prisma.customer.delete({ where: { id: CUSTOMER_ID } }).catch(() => {});
}

await cleanup();

await prisma.customer.create({
  data: {
    id: CUSTOMER_ID,
    whatsappNumber: '+94700000999',
    whatsappId: '94700000999',
    displayName: 'Cursor Test Customer',
    preferredLanguage: 'en'
  }
});
await prisma.lead.create({
  data: { id: LEAD_ID, customerId: CUSTOMER_ID, stage: 'contacted', source: 'RWC', company: 'RWC' }
});

// Messages 0..24, oldest first. timestamps[i] = base + floor(i/5) seconds.
const baseTime = Date.now() - 3600_000;
const created = [];
for (let i = 0; i < MESSAGE_COUNT; i++) {
  const id = `${PREFIX}${String(i).padStart(3, '0')}`;
  const timestamp = new Date(baseTime + Math.floor(i / (MESSAGE_COUNT / DISTINCT_TIMES)) * 1000);
  created.push(id);
  await prisma.message.create({
    data: {
      id,
      leadId: LEAD_ID,
      customerId: CUSTOMER_ID,
      direction: 'inbound',
      senderType: 'customer',
      content: `Cursor message ${i}`,
      status: 'delivered',
      timestamp
    }
  });
}

console.log('\n📦 Cursor pagination across messages sharing a timestamp');

// Walk the whole conversation one page at a time. Every message must appear exactly once:
// a dropped row is silent data loss in the chat history.
const seen = [];
let cursor = null;
let pages = 0;
for (;;) {
  const url = `/api/messages?paginate=1&limit=4&leadId=${LEAD_ID}` +
    (cursor ? `&before=${encodeURIComponent(cursor)}` : '');
  const res = await get(url);
  assert.strictEqual(res.status, 200, `page request failed: ${res.status}`);
  const batch = res.body.messages || [];
  for (const m of batch) seen.push(m.id);
  pages += 1;
  if (!res.body.hasMore || !res.body.nextCursor) break;
  cursor = res.body.nextCursor;
  assert(pages < 50, 'pagination did not terminate');
}

check(`1.1 Every message is returned exactly once when paging (${seen.length}/${MESSAGE_COUNT} seen in ${pages} pages)`, () => {
  assert.strictEqual(seen.length, MESSAGE_COUNT, `expected ${MESSAGE_COUNT} messages, saw ${seen.length}`);
  assert.strictEqual(new Set(seen).size, MESSAGE_COUNT, 'duplicate message ids across pages');
});

check('1.2 Messages sharing an identical timestamp are not skipped', () => {
  const missing = created.filter((id) => !seen.includes(id));
  assert.strictEqual(missing.length, 0, `messages dropped by the cursor: ${missing.join(', ')}`);
});

// The endpoint walks the conversation BACKWARDS from the newest message, so pages arrive
// newest-first while each individual page is chronological. The contract to verify is:
// every page is internally oldest-first, and every page is strictly older than the last.
const pageOrders = [];
{
  let cursor = null;
  for (;;) {
    const url = `/api/messages?paginate=1&limit=4&leadId=${LEAD_ID}` +
      (cursor ? `&before=${encodeURIComponent(cursor)}` : '');
    const res = await get(url);
    const ids = (res.body.messages || []).map((m) => m.id);
    if (ids.length) pageOrders.push(ids);
    if (!res.body.hasMore || !res.body.nextCursor) break;
    cursor = res.body.nextCursor;
  }
}

check('1.3 Each page is chronological and strictly older than the previous page', () => {
  for (const page of pageOrders) {
    const idx = page.map((id) => created.indexOf(id));
    for (let i = 1; i < idx.length; i++) {
      assert(idx[i] > idx[i - 1], `page is not oldest-first: ${page.join(',')}`);
    }
  }
  for (let p = 1; p < pageOrders.length; p++) {
    const newestOfThisPage = created.indexOf(pageOrders[p][pageOrders[p].length - 1]);
    const oldestOfPreviousPage = created.indexOf(pageOrders[p - 1][0]);
    assert(
      newestOfThisPage < oldestOfPreviousPage,
      `page ${p} is not strictly older than page ${p - 1}`
    );
  }
});

// Backward compatibility: a client still holding an old timestamp-only cursor must not
// fail. An empty page is acceptable; a 500 is not.
const legacyCursor = await get(
  `/api/messages?paginate=1&limit=4&leadId=${LEAD_ID}&before=${encodeURIComponent(new Date().toISOString())}`
);
check('1.4a Legacy timestamp-only cursor returns 200 (not an error)', () => {
  assert.strictEqual(legacyCursor.status, 200, `legacy cursor rejected with ${legacyCursor.status}`);
  assert(Array.isArray(legacyCursor.body.messages), 'legacy cursor must still return messages');
});

await cleanup();

console.log(`\n🎉 ALL MESSAGE CURSOR TESTS PASSED (${passed} checks)\n`);

await new Promise((resolve) => server.close(resolve));
server.closeAllConnections?.();
await prisma.$disconnect().catch(() => {});
setTimeout(() => process.exit(0), 200).unref();
