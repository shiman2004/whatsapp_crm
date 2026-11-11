import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { getPrisma } from './src/db.js';
import { signAuthToken } from './server.js';

const TEST_PORT = 3021;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function authHeaders(userId) {
  return { Authorization: `Bearer ${signAuthToken({ userId })}` };
}

function request({ method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw || '{}'), raw });
          } catch {
            resolve({ status: res.statusCode, body: raw, raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTests() {
  console.log('🧪 Starting Dynamic Lead Stages, Persistence, Concurrency & RBAC Test Suite...\n');
  const prisma = getPrisma();
  assert(prisma, 'Prisma client must initialize against crm_test');

  const salt = `${Date.now().toString().slice(-6)}${crypto.randomBytes(2).toString('hex')}`;
  const createdLeadIds = [];
  const createdCustomerIds = [];
  const createdUserIds = [];
  const createdStageIds = [];
  let serverProcess = null;

  try {
  // Ensure admin user
  const adminUser = await prisma.user.upsert({
    where: { id: 'user-admin-stage-test' },
    create: {
      id: 'user-admin-stage-test',
      email: `admin-stage-${salt}@royalwellness.lk`,
      fullName: 'Stage Test Admin',
      role: 'super_admin',
      active: true,
    },
    update: { active: true, role: 'super_admin' },
  });
  createdUserIds.push(adminUser.id);

  // RWC coordinator, AHC sales_coordinator, CRAS coordinator
  const rwcCoord = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      email: `rwc-${salt}@royalwellness.lk`,
      fullName: 'RWC Stage Tester',
      role: 'coordinator',
      company: 'RWC',
      active: true,
    },
  });
  createdUserIds.push(rwcCoord.id);

  const ahcCoord = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      email: `ahc-${salt}@alphahealth.lk`,
      fullName: 'AHC Sales Coord Tester',
      role: 'sales_coordinator',
      company: 'AHC',
      active: true,
    },
  });
  createdUserIds.push(ahcCoord.id);

  const crasCoord = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      email: `cras-${salt}@cras.lk`,
      fullName: 'CRAS Counsellor Tester',
      role: 'coordinator',
      company: 'CRAS',
      active: true,
    },
  });
  createdUserIds.push(crasCoord.id);

  // Seed custom stages (clinical + CRAS-only + inactive)
  const stageSeeds = [
    { key: 'accepted', label: 'Accepted', company: 'ALL', isActive: true, orderIndex: 35, color: '#14b8a6' },
    { key: 'appointment_booked', label: 'Appointment Booked', company: 'ALL', isActive: true, orderIndex: 45, color: '#6366f1' },
    { key: 'consultation__done', label: 'Consultation Done', company: 'ALL', isActive: true, orderIndex: 55, color: '#8b5cf6' },
    { key: 'payment_received', label: 'Payment Received', company: 'ALL', isActive: true, orderIndex: 65, color: '#10b981' },
    { key: `cras_enrolled_${salt}`, label: 'Enrolled CRAS Test', company: 'CRAS', isActive: true, orderIndex: 75, color: '#ec4899' },
    { key: `inactive_stage_${salt}`, label: 'Inactive Test Stage', company: 'ALL', isActive: false, orderIndex: 99, color: '#64748b' },
  ];

  for (const s of stageSeeds) {
    const existing = await prisma.leadStageConfig.findUnique({ where: { key: s.key } });
    if (!existing) {
      const created = await prisma.leadStageConfig.create({
        data: { id: crypto.randomUUID(), ...s },
      });
      createdStageIds.push(created.id);
    }
  }

  // Create RWC, AHC, CRAS customers & leads
  const phoneSuffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 9)}`;
  const rwcCust = await prisma.customer.create({
    data: {
      phoneNumber: `+9477${phoneSuffix}1`,
      whatsappNumber: `9477${phoneSuffix}1`,
      displayName: `Stage Test RWC ${salt}`,
    },
  });
  createdCustomerIds.push(rwcCust.id);

  const ahcCust = await prisma.customer.create({
    data: {
      phoneNumber: `+9477${phoneSuffix}2`,
      whatsappNumber: `9477${phoneSuffix}2`,
      displayName: `Stage Test AHC ${salt}`,
    },
  });
  createdCustomerIds.push(ahcCust.id);

  const crasCust = await prisma.customer.create({
    data: {
      phoneNumber: `+9470${phoneSuffix}3`,
      whatsappNumber: `9470${phoneSuffix}3`,
      displayName: `Stage Test CRAS ${salt}`,
    },
  });
  createdCustomerIds.push(crasCust.id);

  const rwcLead = await prisma.lead.create({
    data: {
      customerId: rwcCust.id,
      company: 'RWC',
      stage: 'new',
      assignedTo: rwcCoord.id,
      assignedAt: new Date(),
    },
  });
  createdLeadIds.push(rwcLead.id);

  const ahcLead = await prisma.lead.create({
    data: {
      customerId: ahcCust.id,
      company: 'AHC',
      stage: 'assigned',
      assignedTo: ahcCoord.id,
      assignedAt: new Date(),
    },
  });
  createdLeadIds.push(ahcLead.id);

  const crasLead = await prisma.lead.create({
    data: {
      customerId: crasCust.id,
      company: 'CRAS',
      stage: 'new',
      assignedTo: crasCoord.id,
      assignedAt: new Date(),
    },
  });
  createdLeadIds.push(crasLead.id);

  const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  serverProcess = spawn('node', ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      NODE_ENV: 'test',
      DATABASE_URL: testDbUrl,
      DIRECT_URL: testDbUrl,
    },
    stdio: 'pipe',
  });

    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        const ping = await request({ method: 'GET', path: '/api/db/status' });
        if (ping.status === 200) {
          ready = true;
          break;
        }
      } catch {}
      await sleep(500);
    }
    assert(ready, 'Test server failed to become ready');

    // 1. Stage company filtering on GET /api/stages
    const rwcStagesRes = await request({
      method: 'GET',
      path: '/api/stages?company=RWC',
      headers: authHeaders(adminUser.id),
    });
    assert.equal(rwcStagesRes.status, 200);
    const rwcStageKeys = new Set((rwcStagesRes.body.stages || []).map((s) => s.key));
    assert(rwcStageKeys.has('appointment_booked'), 'Expected shared custom stage in RWC stages');
    assert(!rwcStageKeys.has(`cras_enrolled_${salt}`), 'CRAS-only stage must be filtered out for company=RWC');
    console.log('✅ 1. /api/stages?company=RWC filtering passed');

    // 2. Legacy and custom stage progression + DB persistence & reload
    const transitions = ['accepted', 'appointment_booked', 'consultation__done', 'payment_received', 'converted', 'potential'];
    for (const nextStage of transitions) {
      const res = await request({
        method: 'POST',
        path: '/api/leads/update',
        headers: authHeaders(adminUser.id),
        body: {
          leadId: rwcLead.id,
          stage: nextStage,
          reason: `Transition to ${nextStage}`,
        },
      });
      assert.equal(res.status, 200, `Expected 200 updating stage to ${nextStage}, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.success, true);
      assert.equal(res.body.lead.stage, nextStage);
      assert(res.body.stageHistory, 'Expected transactional stageHistory record');
      assert.equal(res.body.stageHistory.toStage, nextStage);
    }

    // Verify GET /api/leads reload reflects latest dynamic stage without Prisma enum errors
    const reloadRes = await request({
      method: 'GET',
      path: `/api/leads?paginate=1&pageSize=20&company=RWC&search=${encodeURIComponent(rwcCust.whatsappNumber)}`,
      headers: authHeaders(adminUser.id),
    });
    assert.equal(reloadRes.status, 200);
    const reloadedList = Array.isArray(reloadRes.body) ? reloadRes.body : (reloadRes.body.leads || []);
    const reloaded = reloadedList.find((l) => l.id === rwcLead.id);
    assert(reloaded, 'Reloaded RWC lead must be returned by /api/leads');
    assert.equal(reloaded.stage, 'potential');
    console.log('✅ 2. Legacy & custom dynamic stage updates + DB reload persistence passed');

    // 3. No duplicate stage history on idempotent same-stage update
    const beforeCount = await prisma.leadStageHistory.count({ where: { leadId: rwcLead.id } });
    assert.equal(beforeCount, transitions.length, 'History count should match exact distinct transitions');

    const idempotentRes = await request({
      method: 'POST',
      path: '/api/leads/update',
      headers: authHeaders(adminUser.id),
      body: { leadId: rwcLead.id, stage: 'potential', reason: 'Same stage click' },
    });
    assert.equal(idempotentRes.status, 200);
    assert.ok(!idempotentRes.body.stageHistory, 'Same-stage save must not create duplicate history');
    const afterCount = await prisma.leadStageHistory.count({ where: { leadId: rwcLead.id } });
    assert.equal(afterCount, beforeCount);
    console.log('✅ 3. Stage history exact-once recording passed');

    // 4. Invalid, malformed, inactive stage rejection (no HTTP 500)
    const unknownRes = await request({
      method: 'POST',
      path: '/api/leads/update',
      headers: authHeaders(adminUser.id),
      body: { leadId: rwcLead.id, stage: 'nonexistent_stage_999' },
    });
    assert.equal(unknownRes.status, 400);
    assert.equal(unknownRes.body.errorCode, 'UNKNOWN_STAGE');

    const badFormatRes = await request({
      method: 'POST',
      path: '/api/leads/update',
      headers: authHeaders(adminUser.id),
      body: { leadId: rwcLead.id, stage: 'invalid stage!' },
    });
    assert.equal(badFormatRes.status, 400);
    assert.equal(badFormatRes.body.errorCode, 'INVALID_STAGE_KEY');

    const inactiveRes = await request({
      method: 'POST',
      path: '/api/leads/update',
      headers: authHeaders(adminUser.id),
      body: { leadId: rwcLead.id, stage: `inactive_stage_${salt}` },
    });
    assert.equal(inactiveRes.status, 400);
    assert.equal(inactiveRes.body.errorCode, 'INACTIVE_STAGE');
    console.log('✅ 4. Invalid / malformed / inactive stage rejection passed');

    // 5. Company isolation & RBAC checks (including sales_coordinator & AHC)
    const crossCompanyStageRes = await request({
      method: 'POST',
      path: '/api/leads/update',
      headers: authHeaders(adminUser.id),
      body: { leadId: rwcLead.id, stage: `cras_enrolled_${salt}` },
    });
    assert.equal(crossCompanyStageRes.status, 403);
    assert.equal(crossCompanyStageRes.body.errorCode, 'STAGE_COMPANY_MISMATCH');

    const coordForbiddenRes = await request({
      method: 'POST',
      path: '/api/leads/update',
      headers: authHeaders(rwcCoord.id),
      body: { leadId: crasLead.id, stage: 'contacted' },
    });
    assert.equal(coordForbiddenRes.status, 403);

    const ahcListRes = await request({
      method: 'GET',
      path: '/api/leads?paginate=1&pageSize=20&company=AHC',
      headers: authHeaders(ahcCoord.id),
    });
    assert.equal(ahcListRes.status, 200);
    const ahcList = Array.isArray(ahcListRes.body) ? ahcListRes.body : (ahcListRes.body.leads || []);
    assert(ahcList.some((l) => l.id === ahcLead.id), 'AHC sales_coordinator must see their assigned AHC lead');

    const ahcUpdateRes = await request({
      method: 'POST',
      path: '/api/leads/update',
      headers: authHeaders(ahcCoord.id),
      body: { leadId: ahcLead.id, stage: 'appointment_booked' },
    });
    assert.equal(ahcUpdateRes.status, 200);
    assert.equal(ahcUpdateRes.body.lead.stage, 'appointment_booked');
    console.log('✅ 5. Company isolation & RBAC (including AHC sales_coordinator) passed');

    // 6. Concurrent expectedStage conflict protection (409 STAGE_CONFLICT)
    const staleRes = await request({
      method: 'POST',
      path: '/api/leads/update',
      headers: authHeaders(adminUser.id),
      body: { leadId: rwcLead.id, stage: 'converted', expectedStage: 'new' },
    });
    assert.equal(staleRes.status, 409);
    assert.equal(staleRes.body.errorCode, 'STAGE_CONFLICT');

    // Fire 2 concurrent transitions with matching expectedStage ('potential') -> 1 wins (200), 1 conflicts (409)
    const [raceA, raceB] = await Promise.all([
      request({
        method: 'POST',
        path: '/api/leads/update',
        headers: authHeaders(adminUser.id),
        body: { leadId: rwcLead.id, stage: 'appointment_booked', expectedStage: 'potential' },
      }),
      request({
        method: 'POST',
        path: '/api/leads/update',
        headers: authHeaders(adminUser.id),
        body: { leadId: rwcLead.id, stage: 'payment_received', expectedStage: 'potential' },
      }),
    ]);
    const statuses = [raceA.status, raceB.status].sort();
    assert.deepEqual(statuses, [200, 409], `Expected [200, 409] on concurrent update race, got ${JSON.stringify(statuses)}`);
    console.log('✅ 6. Concurrent stage update protection (409 STAGE_CONFLICT) passed');

    // 7. Missing lead returns 404 instead of 500
    const missingRes = await request({
      method: 'POST',
      path: '/api/leads/update',
      headers: authHeaders(adminUser.id),
      body: { leadId: '00000000-0000-0000-0000-000000000000', stage: 'contacted' },
    });
    assert.equal(missingRes.status, 404);
    assert.equal(missingRes.body.errorCode, 'LEAD_NOT_FOUND');
    console.log('✅ 7. Missing lead 404 handling passed');

    // 8. Retired / historical stage preservation on update & restore
    const retiredStageKey = `retired_hist_${salt}`;
    await prisma.lead.update({ where: { id: rwcLead.id }, data: { stage: retiredStageKey } });
    const preserveRes = await request({
      method: 'POST',
      path: '/api/leads/update',
      headers: authHeaders(adminUser.id),
      body: { leadId: rwcLead.id, stage: retiredStageKey, language: 'ta' },
    });
    assert.equal(preserveRes.status, 200, `Keeping lead's own historical stage must succeed: ${preserveRes.raw}`);
    assert.equal(preserveRes.body.lead.stage, retiredStageKey);

    const moveOffRes = await request({
      method: 'POST',
      path: '/api/leads/update',
      headers: authHeaders(adminUser.id),
      body: { leadId: rwcLead.id, stage: 'converted' },
    });
    assert.equal(moveOffRes.status, 200);

    const restoreHistRes = await request({
      method: 'POST',
      path: '/api/leads/update',
      headers: authHeaders(adminUser.id),
      body: { leadId: rwcLead.id, stage: retiredStageKey },
    });
    assert.equal(restoreHistRes.status, 200, 'Restoring verified historical stage from lead history must succeed');
    assert.equal(restoreHistRes.body.lead.stage, retiredStageKey);
    console.log('✅ 8. Retired historical stage preservation & history restore passed\n🎉 ALL DYNAMIC STAGE BACKEND TESTS PASSED!');
  } finally {
    if (serverProcess) serverProcess.kill('SIGTERM');
    if (createdLeadIds.length) {
      await prisma.leadStageHistory.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await prisma.leadAssignmentHistory.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
    }
    if (createdCustomerIds.length) {
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    }
    if (createdStageIds.length) {
      await prisma.leadStageConfig.deleteMany({ where: { id: { in: createdStageIds } } });
    }
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
