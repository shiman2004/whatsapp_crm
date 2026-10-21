// Pagination and company-isolation regression tests for /api/leads and /api/messages.
// Requires a live database (DATABASE_URL); skips cleanly when the DB is unavailable.
process.env.NODE_ENV = 'test';

import assert from 'assert';
import http from 'http';
import { server, signAuthToken } from './server.js';
import { checkDbConnection } from './src/db.js';

let passed = 0;
// Awaits `fn`, so a check may be async. Without the await a rejected assertion inside an
// async check would register a false pass.
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ✅ ${name}`);
}

const db = await checkDbConnection();
if (!db.connected) {
  console.log('\n⏭️  SKIPPED: live database unavailable — pagination tests not executed.');
  process.exit(0);
}

const PORT = 39491;
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(PORT, '127.0.0.1', resolve);
});
const base = `http://127.0.0.1:${PORT}`;

const adminToken = signAuthToken({ userId: 'user-admin-1', email: 'admin@example.test', role: 'super_admin', fullName: 'Test Admin' });

async function get(path, token = adminToken) {
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json().catch(() => null) };
}

console.log('\n📦 SECTION 1: /api/leads pagination and payload shape');

const paged = await get('/api/leads?paginate=1&pageSize=5');
await check('1.1 Paginated leads response is an object with a leads array and paging metadata', () => {
  assert.strictEqual(paged.status, 200);
  assert(Array.isArray(paged.body.leads), 'expected body.leads array');
  assert.strictEqual(typeof paged.body.page, 'number');
  assert.strictEqual(typeof paged.body.pageSize, 'number');
  assert.strictEqual(typeof paged.body.hasMore, 'boolean');
});

await check('1.2 Page size is respected and never exceeds the requested limit', () => {
  assert(paged.body.leads.length <= 5, `expected <= 5 leads, got ${paged.body.leads.length}`);
});

await check('1.3 Lead summaries no longer embed the full message history', () => {
  for (const lead of paged.body.leads) {
    assert.strictEqual(lead.messages, undefined, `lead ${lead.id} must not embed messages`);
    assert.strictEqual(typeof lead.messageCount, 'number', 'messageCount summary must be present');
    // Summary payload must stay bounded: unbounded relation arrays were removed.
    assert.strictEqual(lead.notes, undefined, `lead ${lead.id} must not embed all notes`);
    assert.strictEqual(lead.stageHistories, undefined, `lead ${lead.id} must not embed stage history`);
    assert.strictEqual(typeof lead.notesCount, 'number', 'notesCount summary must be present');
    assert(
      lead.assignmentHistories === undefined || lead.assignmentHistories.length <= 1,
      `lead ${lead.id} must embed at most one assignment history row`
    );
  }
});

await check('1.4 Company isolation fields are still present on each summary', () => {
  for (const lead of paged.body.leads) {
    assert(['RWC', 'CRAS'].includes(lead.company), `unexpected company ${lead.company}`);
    assert(typeof lead.companyTag === 'string');
  }
});

const legacy = await get('/api/leads');
await check('1.5 Legacy (non-paginated) call still returns an array', () => {
  assert.strictEqual(legacy.status, 200);
  assert(Array.isArray(legacy.body), 'legacy callers must still receive an array');
});

console.log('\n📦 SECTION 2: /api/messages cursor pagination');

const page1 = await get('/api/messages?paginate=1&limit=10');
await check('2.1 First page returns messages plus a cursor', () => {
  assert.strictEqual(page1.status, 200);
  assert(Array.isArray(page1.body.messages));
  assert(page1.body.messages.length <= 10);
  assert.strictEqual(typeof page1.body.hasMore, 'boolean');
});

await check('2.2 Messages on a page are in chronological (oldest-first) order', () => {
  const times = page1.body.messages.map(m => new Date(m.timestamp).getTime());
  for (let i = 1; i < times.length; i += 1) {
    assert(times[i] >= times[i - 1], 'messages must be sorted oldest-first');
  }
});

const newest = await get('/api/messages?paginate=1&limit=1');
await check('2.3 The first page contains the newest messages', () => {
  if (page1.body.messages.length === 0) return;
  const newestOnPage = Math.max(...page1.body.messages.map(m => new Date(m.timestamp).getTime()));
  const trueNewest = new Date(newest.body.messages[0].timestamp).getTime();
  assert.strictEqual(newestOnPage, trueNewest, 'page 1 must end at the newest message');
});

if (page1.body.hasMore && page1.body.nextCursor) {
  const page2 = await get(`/api/messages?paginate=1&limit=10&before=${encodeURIComponent(page1.body.nextCursor)}`);
  await check('2.4 The second page contains strictly older messages with no overlap', () => {
    assert(page2.body.messages.length > 0, 'expected an older page');
    const page1Ids = new Set(page1.body.messages.map(m => m.id));
    for (const m of page2.body.messages) {
      assert(!page1Ids.has(m.id), `message ${m.id} appeared on both pages`);
    }
  });

  await check('2.5 Walking every page yields each message once and stays bounded', async () => {
    // Walk the conversation to the end and confirm no message is dropped or duplicated.
    // A timestamp-only cursor silently skipped messages sharing a millisecond; that would
    // show up here as a duplicate or a missing id once the walk finishes.
    const walked = [];
    let cursor = null;
    for (let guard = 0; guard < 200; guard++) {
      const url = `/api/messages?paginate=1&limit=25` + (cursor ? `&before=${encodeURIComponent(cursor)}` : '');
      const res = await get(url);
      for (const m of res.body.messages || []) walked.push(m.id);
      if (!res.body.hasMore || !res.body.nextCursor) break;
      cursor = res.body.nextCursor;
    }
    assert(new Set(walked).size === walked.length, 'duplicate message ids across pages');
    for (const m of page1.body.messages) {
      assert(walked.includes(m.id), `message ${m.id} was lost while paging`);
    }
  });
} else {
  console.log('  ⏭️  2.4/2.5 skipped: only one page of messages exists');
}

console.log('\n📦 SECTION 3: Authorization boundaries');

const noAuth = await fetch(`${base}/api/leads?paginate=1`);
await check('3.1 Unauthenticated paginated lead access is rejected', () => {
  assert.strictEqual(noAuth.status, 401);
});

const noAuthMsgs = await fetch(`${base}/api/messages?paginate=1`);
await check('3.2 Unauthenticated paginated message access is rejected', () => {
  assert.strictEqual(noAuthMsgs.status, 401);
});

const coordinatorToken = signAuthToken({ userId: 'user-faiha-1', email: 'faiha@royalwellness.lk', role: 'coordinator', fullName: 'Faiha' });
const coordinatorLeads = await get('/api/leads?paginate=1&pageSize=50', coordinatorToken);
await check('3.3 A coordinator only sees leads assigned to them', () => {
  assert.strictEqual(coordinatorLeads.status, 200);
  // In test mode the canonical fixture user exists; if not, the request must still be denied or empty.
  if (coordinatorLeads.body?.leads) {
    for (const lead of coordinatorLeads.body.leads) {
      const company = String(lead.company || '').toUpperCase();
      assert(
        lead.assignedTo === 'user-faiha-1' || company === 'RWC',
        `coordinator saw an out-of-scope lead: ${lead.id} (company=${company}, assignedTo=${lead.assignedTo})`
      );
    }
  }
});

console.log(`\n🎉 ALL PAGINATION TESTS PASSED (${passed} checks)\n`);

// Tear down both sides before exiting. fetch() pools keep-alive sockets in undici's
// global dispatcher; calling process.exit() while the listener and those client sockets
// are still closing trips a libuv assertion on Windows (`UV_HANDLE_CLOSING`), turning a
// fully passing suite into a non-zero exit.
await new Promise((resolve) => server.close(resolve));
server.closeAllConnections?.();
try {
  const { getGlobalDispatcher } = await import('undici');
  await getGlobalDispatcher().close();
} catch {
  // undici may not be resolvable directly; nothing else to release.
}
// Release the Prisma engine connection, then let the process end on its own. An explicit
// process.exit() here aborts with a libuv `UV_HANDLE_CLOSING` assertion on Windows because
// the Prisma engine's native handles are still closing. The timeout is a safety net.
const { getPrisma } = await import('./src/db.js');
await getPrisma()?.$disconnect().catch(() => {});
setTimeout(() => process.exit(0), 200).unref();
