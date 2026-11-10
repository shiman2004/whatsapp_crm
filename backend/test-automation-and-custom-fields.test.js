/**
 * Verification suite for:
 * [B] Custom Fields Dynamic Definitions & Entity Value Persistence
 * [C] Event-Driven Automation Engine (Condition Evaluation, Dry-Run, & Execution)
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { server, signAuthToken } from './server.js';
import { getPrisma, checkDbConnection } from './src/db.js';
import { evaluateAutomationCondition, dryRunAutomationRule } from './src/automationEngine.js';

let passed = 0;
let failed = 0;

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

function req(port, { method, path, token, body }) {
  return new Promise((resolve, reject) => {
    const r = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data || '{}') }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

console.log('🧪 Starting Automation Engine & Custom Fields Verification Suite...\n');

await test('1.1 Automation condition parser safely evaluates expressions', () => {
  assert.strictEqual(evaluateAutomationCondition('true', {}), true);
  assert.strictEqual(evaluateAutomationCondition('brand == "RWC"', { brand: 'RWC' }), true);
  assert.strictEqual(evaluateAutomationCondition('brand == "CRAS"', { brand: 'RWC' }), false);
  assert.strictEqual(evaluateAutomationCondition('new_stage == "converted" && deal_value > 100000', { new_stage: 'converted', deal_value: 150000 }), true);
  assert.strictEqual(evaluateAutomationCondition('new_stage == "converted" && deal_value > 100000', { new_stage: 'converted', deal_value: 50000 }), false);
});

await test('1.2 Automation dry-run validates rule and context', () => {
  const res = dryRunAutomationRule(
    { trigger: 'lead.created', condition: 'brand == "RWC"', action: 'assign_round_robin' },
    { company: 'RWC' }
  );
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.conditionPassed, true);
  assert.strictEqual(res.actionValid, true);
});

const dbRes = await checkDbConnection();
if (dbRes.connected) {
  const prisma = getPrisma();
  const port = 3038;
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));

  try {
    const adminToken = signAuthToken({ userId: 'user-admin-1', role: 'super_admin' });
    const coord = await prisma.user.findFirst({ where: { role: 'coordinator', active: true } });
    const coordToken = signAuthToken({ userId: coord?.id || 'user-admin-1', role: coord?.role || 'super_admin' });

    await test('2.1 POST /api/settings/automation/test dry-runs via backend engine', async () => {
      const r = await req(port, {
        method: 'POST',
        path: '/api/settings/automation/test',
        token: adminToken,
        body: { rule: { trigger: 'deal.stage_changed', condition: 'true', action: 'dispatch_webhook' }, context: { company: 'RWC' } }
      });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.success, true);
      assert.strictEqual(r.body.conditionPassed, true);
    });

    await test('2.2 Custom Fields definition & coordinator entity value save/read works', async () => {
      const testEntityId = `test-lead-${Date.now()}`;
      // Save values as regular coordinator
      const putRes = await req(port, {
        method: 'PUT',
        path: `/api/custom-fields/values/lead/${testEntityId}`,
        token: coordToken,
        body: { values: { cf_1: 'Allergic to Penicillin', cf_2: '2026-12-01' } }
      });
      assert.strictEqual(putRes.status, 200);
      assert.strictEqual(putRes.body.values.cf_1, 'Allergic to Penicillin');

      // Read back values
      const getRes = await req(port, {
        method: 'GET',
        path: `/api/custom-fields/values/lead/${testEntityId}`,
        token: coordToken
      });
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.body.values.cf_1, 'Allergic to Penicillin');

      // Read definitions endpoint
      const defsRes = await req(port, {
        method: 'GET',
        path: '/api/custom-fields/definitions?entity=lead&company=RWC',
        token: coordToken
      });
      assert.strictEqual(defsRes.status, 200);
      assert(Array.isArray(defsRes.body.fields));

      // Cleanup test setting row
      await prisma.systemSetting.deleteMany({ where: { section: 'custom_field_values', scope: 'lead', scopeId: testEntityId } });
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

console.log(`\nAutomation & Custom Fields: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
