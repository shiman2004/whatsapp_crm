import assert from 'node:assert/strict';
import {
  getAllConnections,
  getConnectionById,
  testConnection,
  reconnectConnection,
  getConnectionHistory,
  logConnectionEvent
} from './src/whatsappConnectionService.js';
import { handleWhatsAppConnectionRoutes } from './src/whatsappConnectionRoutes.js';

console.log('🧪 Starting WhatsApp Connection Settings & Reconnect Test Suite...');

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(code, headers = {}) {
      this.statusCode = code;
      this.headers = headers;
    },
    end(data = '') {
      this.body = data;
    }
  };
}

const realFetch = globalThis.fetch;
const PHONE_OK = {
  id: '1358157244046701',
  display_phone_number: '+94 70 639 3353',
  verified_name: 'Royal Wellness Center',
  code_verification_status: 'VERIFIED',
  quality_rating: 'GREEN',
  status: 'CONNECTED'
};
const WABA_OK = { id: '2332922997481634', name: 'WABA', timezone_id: 'Asia/Colombo', account_review_status: 'APPROVED' };

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

/** Replace Meta Graph calls with canned responses so no live credentials/network are used. */
function metaResponder({ phone, waba, subscribe } = {}) {
  return async (url, init = {}) => {
    const target = String(url);
    assert.ok(target.startsWith('https://graph.facebook.com/v20.0/'), `Unexpected fetch to ${target}`);
    if (target.includes('/subscribed_apps')) {
      if (init.method === 'POST') return subscribe || jsonResponse({ success: true });
      return jsonResponse({ data: [{ id: 'app-test' }] });
    }
    if (target.includes('timezone_id')) return waba || jsonResponse(WABA_OK);
    return phone || jsonResponse(PHONE_OK);
  };
}

async function withMetaMock(responder, fn) {
  globalThis.fetch = responder;
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
  }
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  const adminUser = { id: 'admin-1', role: 'super_admin', fullName: 'Super Admin' };

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ ${name}:`, err.message);
      failed++;
    }
  }

  await test('Test 1: Multi-brand connections returned without leaking credentials', async () => {
    const connections = await getAllConnections();
    assert.ok(Array.isArray(connections));
    assert.ok(connections.length >= 3);
    const companies = connections.map((c) => c.company);
    for (const company of ['RWC', 'CRAS', 'AHC']) assert.ok(companies.includes(company));
    for (const c of connections) {
      assert.strictEqual(c.accessToken, undefined);
      assert.strictEqual(c.appSecret, undefined);
      assert.strictEqual(c.webhookSecret, undefined);
    }
  });

  await test('Test 2: Single connection lookup by ID', async () => {
    const rwcConn = await getConnectionById('conn-rwc');
    assert.ok(rwcConn);
    assert.strictEqual(rwcConn.company, 'RWC');
    assert.strictEqual(rwcConn.displayName, 'Royal Wellness Center');
    assert.strictEqual(await getConnectionById('conn-non-existent'), null);
  });

  await test('Test 3: 401 Unauthorized enforced for unauthenticated requests', async () => {
    const res = createMockRes();
    const handled = await handleWhatsAppConnectionRoutes({ method: 'GET' }, res, '/api/whatsapp/connections', null, 'c1');
    assert.ok(handled);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(JSON.parse(res.body).success, false);
  });

  await test('Test 4: 403 Forbidden enforced for staff roles', async () => {
    const staffUser = { id: 'user-staff-1', role: 'leads_officer', fullName: 'Staff Member' };
    const res = createMockRes();
    const handled = await handleWhatsAppConnectionRoutes(
      { method: 'POST' }, res, '/api/whatsapp/connections/conn-rwc/reconnect', staffUser, 'c2'
    );
    assert.ok(handled);
    assert.strictEqual(res.statusCode, 403);
  });

  await test('Test 5: Super Admin can view connection list with summary metrics', async () => {
    const res = createMockRes();
    const handled = await handleWhatsAppConnectionRoutes({ method: 'GET' }, res, '/api/whatsapp/connections', adminUser, 'c3');
    assert.ok(handled);
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(typeof body.summary.total, 'number');
  });

  await test('Test 6: Connection logs and history retrieval work reliably', async () => {
    await logConnectionEvent({
      connectionId: 'conn-rwc',
      eventType: 'TEST_CONNECTION',
      status: 'SUCCESS',
      responseTimeMs: 142,
      performedById: adminUser.id,
      performedByName: adminUser.fullName,
      details: { check: 'unit_test' }
    });
    assert.ok(Array.isArray(await getConnectionHistory('conn-rwc', 5)));
  });

  await test('Test 7: Test Connection reports success with response-time metrics', async () => {
    const result = await withMetaMock(metaResponder(), () => testConnection('conn-rwc', adminUser));
    assert.strictEqual(result.success, true);
    assert.ok(result.responseTimeMs >= 0);
    assert.strictEqual(result.checks.phoneVerified, true);
    assert.strictEqual(result.checks.webhookSubscribed, true);
  });

  await test('Test 8: Expired token maps to EXPIRED with corrective guidance', async () => {
    const expired = jsonResponse({ error: { code: 190, message: 'Invalid OAuth access token' } }, 401);
    const result = await withMetaMock(metaResponder({ phone: expired }), () => testConnection('conn-rwc', adminUser));
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.connectionStatus, 'EXPIRED');
    assert.match(result.correctiveAction, /Render|META_ACCESS_TOKEN/);
  });

  await test('Test 9: Invalid Phone Number ID maps to ERROR', async () => {
    const invalid = jsonResponse({ error: { code: 100, message: '(#100) Object with id does not exist' } }, 400);
    const result = await withMetaMock(metaResponder({ phone: invalid }), () => testConnection('conn-cras', adminUser));
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.connectionStatus, 'ERROR');
  });

  await test('Test 10: Reconnect succeeds only when webhook re-subscription is confirmed', async () => {
    const result = await withMetaMock(metaResponder(), () => reconnectConnection('conn-ahc', adminUser));
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.connectionStatus, 'CONNECTED');
  });

  await test('Test 11: Reconnect refuses to declare success when Meta rejects webhook re-subscription', async () => {
    const rejected = jsonResponse({ success: false, error: { code: 100, message: 'Webhook not subscribed' } }, 400);
    const result = await withMetaMock(metaResponder({ subscribe: rejected }), () => reconnectConnection('conn-rwc', adminUser));
    assert.strictEqual(result.success, false);
    assert.notStrictEqual(result.connectionStatus, 'CONNECTED');
    assert.ok(result.correctiveAction);
  });

  await test('Test 12: Concurrent reconnect attempts are guarded', async () => {
    const [res1, res2] = await withMetaMock(metaResponder(), () =>
      Promise.all([
        reconnectConnection('conn-cras', adminUser),
        reconnectConnection('conn-cras', adminUser)
      ])
    );
    assert.ok(res1.alreadyInProgress || res1.rateLimited || res2.alreadyInProgress || res2.rateLimited);
  });

  await test('Test 13: Route returns 409 Conflict for duplicate reconnect attempts', async () => {
    const res = createMockRes();
    await withMetaMock(metaResponder(), async () => {
      await handleWhatsAppConnectionRoutes(
        { method: 'POST' }, createMockRes(), '/api/whatsapp/connections/conn-cras/reconnect', adminUser, 'c4'
      );
      return handleWhatsAppConnectionRoutes(
        { method: 'POST' }, res, '/api/whatsapp/connections/conn-cras/reconnect', adminUser, 'c5'
      );
    });
    assert.strictEqual(res.statusCode, 409);
  });

  console.log(`\n🏁 Test Run Complete: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Unexpected error in test runner:', err);
  process.exit(1);
});
