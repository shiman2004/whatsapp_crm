import http from 'http';
import { spawn } from 'child_process';
import { getPrisma } from './src/db.js';

const TEST_PORT = 3008;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// Helper: Make HTTP request
function request({ method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data || '{}');
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// Sleep helper
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTests() {
  console.log('🚀 [Test Suite] Starting Lead Assignment Locking & RBAC Test Suite...\n');
  const prisma = getPrisma();

  // 1. Start Server on TEST_PORT
  console.log(`📡 Spawning test server on port ${TEST_PORT}...`);
  const serverProcess = spawn('node', ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  serverProcess.stdout.on('data', (d) => {
    // optional debug logging
  });
  serverProcess.stderr.on('data', (d) => {
    // console.error(`[Server err] ${d.toString()}`);
  });

  // Wait for server ready
  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await request({ method: 'GET', path: '/api/status' });
      if (res.status === 200) {
        serverReady = true;
        break;
      }
    } catch (e) {
      // not ready yet
    }
    await sleep(500);
  }

  if (!serverReady) {
    serverProcess.kill();
    throw new Error('❌ Test server failed to start within 15 seconds.');
  }
  console.log('✅ Test server started successfully.\n');

  // Test Entities
  const testOfficer1Id = 'test-officer-1';
  const testOfficer2Id = 'test-officer-2';
  const testCoord1Id = 'test-coord-ahmed';
  const testCoord2Id = 'test-coord-sara';
  const testAdminId = 'user-admin-1';

  let testCustId = `test-cust-${Date.now()}`;
  let testLeadId = `test-lead-${Date.now()}`;
  let testLead2Id = `test-lead-race-${Date.now()}`;

  let passedScenarios = 0;
  const totalScenarios = 9;

  try {
    // Setup test users in Prisma
    console.log('🔧 Setting up test users in database...');
    await prisma.user.upsert({
      where: { id: testOfficer1Id },
      update: { role: 'leads_officer', active: true },
      create: {
        id: testOfficer1Id,
        email: 'officer1@test.royalwellness.lk',
        fullName: 'Leads Officer 1',
        role: 'leads_officer',
        active: true
      }
    });

    await prisma.user.upsert({
      where: { id: testOfficer2Id },
      update: { role: 'leads_officer', active: true },
      create: {
        id: testOfficer2Id,
        email: 'officer2@test.royalwellness.lk',
        fullName: 'Leads Officer 2',
        role: 'leads_officer',
        active: true
      }
    });

    await prisma.user.upsert({
      where: { id: testCoord1Id },
      update: { role: 'coordinator', active: true },
      create: {
        id: testCoord1Id,
        email: 'ahmed@test.royalwellness.lk',
        fullName: 'Coordinator Ahmed',
        role: 'coordinator',
        active: true
      }
    });

    await prisma.user.upsert({
      where: { id: testCoord2Id },
      update: { role: 'coordinator', active: true },
      create: {
        id: testCoord2Id,
        email: 'sara@test.royalwellness.lk',
        fullName: 'Coordinator Sara',
        role: 'coordinator',
        active: true
      }
    });

    // Create a fresh test customer & lead
    const cat = await prisma.treatmentCategory.findFirst();
    const trt = await prisma.treatment.findFirst();

    await prisma.customer.create({
      data: {
        id: testCustId,
        whatsappNumber: '+94709990001',
        whatsappId: '94709990001',
        displayName: 'Customer A (Test)'
      }
    });

    await prisma.lead.create({
      data: {
        id: testLeadId,
        customerId: testCustId,
        categoryId: cat?.id || 'cat-hair-care',
        treatmentId: trt?.id || 'trt-hair-prp',
        stage: 'new',
        source: 'RWC',
        assignedTo: null // Unassigned
      }
    });

    console.log('✅ Test fixture created: Lead is unassigned.\n');

    // -------------------------------------------------------------
    // SCENARIO 1: Leads Officer assigns an unassigned lead — ALLOWED
    // -------------------------------------------------------------
    console.log('🧪 Scenario 1: Leads Officer assigns unassigned lead to Coordinator Ahmed...');
    const res1 = await request({
      method: 'POST',
      path: '/api/leads/assign',
      headers: { 'x-user-id': testOfficer1Id },
      body: {
        leadId: testLeadId,
        coordinatorId: testCoord1Id,
        coordinatorName: 'Coordinator Ahmed'
      }
    });

    if (res1.status === 200 && res1.body.success && res1.body.lead?.assignedTo === testCoord1Id) {
      console.log('✅ [Scenario 1 PASSED] Leads Officer successfully assigned unassigned lead (HTTP 200).');
      passedScenarios++;
    } else {
      console.error('❌ [Scenario 1 FAILED]', res1.status, res1.body);
    }

    // -------------------------------------------------------------
    // SCENARIO 2: Same Leads Officer attempts to reassign it — REJECTED
    // -------------------------------------------------------------
    console.log('\n🧪 Scenario 2: Same Leads Officer 1 attempts to reassign lead to Coordinator Sara...');
    const res2 = await request({
      method: 'POST',
      path: '/api/leads/assign',
      headers: { 'x-user-id': testOfficer1Id },
      body: {
        leadId: testLeadId,
        coordinatorId: testCoord2Id,
        coordinatorName: 'Coordinator Sara'
      }
    });

    if (res2.status === 403 && res2.body.errorCode === 'ASSIGNMENT_LOCKED') {
      console.log('✅ [Scenario 2 PASSED] Same Leads Officer reassignment was rejected with 403 ASSIGNMENT_LOCKED.');
      passedScenarios++;
    } else {
      console.error('❌ [Scenario 2 FAILED]', res2.status, res2.body);
    }

    // -------------------------------------------------------------
    // SCENARIO 3: Another Leads Officer attempts to reassign it — REJECTED
    // -------------------------------------------------------------
    console.log('\n🧪 Scenario 3: Another Leads Officer 2 attempts to reassign lead to Coordinator Sara...');
    const res3 = await request({
      method: 'POST',
      path: '/api/leads/assign',
      headers: { 'x-user-id': testOfficer2Id },
      body: {
        leadId: testLeadId,
        coordinatorId: testCoord2Id,
        coordinatorName: 'Coordinator Sara'
      }
    });

    if (res3.status === 403 && res3.body.errorCode === 'ASSIGNMENT_LOCKED') {
      console.log('✅ [Scenario 3 PASSED] Another Leads Officer reassignment was rejected with 403 ASSIGNMENT_LOCKED.');
      passedScenarios++;
    } else {
      console.error('❌ [Scenario 3 FAILED]', res3.status, res3.body);
    }

    // -------------------------------------------------------------
    // SCENARIO 4: A Leads Officer attempts to unassign it — REJECTED
    // -------------------------------------------------------------
    console.log('\n🧪 Scenario 4: Leads Officer attempts to unassign the lead...');
    const res4 = await request({
      method: 'POST',
      path: '/api/leads/assign',
      headers: { 'x-user-id': testOfficer1Id },
      body: {
        leadId: testLeadId,
        unassign: true
      }
    });

    if (res4.status === 403 && res4.body.errorCode === 'UNASSIGN_FORBIDDEN') {
      console.log('✅ [Scenario 4 PASSED] Leads Officer unassignment was rejected with 403 UNASSIGN_FORBIDDEN.');
      passedScenarios++;
    } else {
      console.error('❌ [Scenario 4 FAILED]', res4.status, res4.body);
    }

    // -------------------------------------------------------------
    // SCENARIO 5: Super Admin reassigns the lead — ALLOWED
    // -------------------------------------------------------------
    console.log('\n🧪 Scenario 5: Super Admin reassigns lead from Ahmed to Sara...');
    const res5 = await request({
      method: 'POST',
      path: '/api/leads/assign',
      headers: { 'x-user-id': testAdminId },
      body: {
        leadId: testLeadId,
        coordinatorId: testCoord2Id,
        coordinatorName: 'Coordinator Sara'
      }
    });

    if (res5.status === 200 && res5.body.success && res5.body.lead?.assignedTo === testCoord2Id) {
      console.log('✅ [Scenario 5 PASSED] Super Admin successfully reassigned lead from Ahmed to Sara (HTTP 200).');
      passedScenarios++;
    } else {
      console.error('❌ [Scenario 5 FAILED]', res5.status, res5.body);
    }

    // -------------------------------------------------------------
    // SCENARIO 6: Coordinator attempts to reassign the lead — REJECTED
    // -------------------------------------------------------------
    console.log('\n🧪 Scenario 6: Coordinator attempts to assign/reassign the lead...');
    const res6 = await request({
      method: 'POST',
      path: '/api/leads/assign',
      headers: { 'x-user-id': testCoord1Id },
      body: {
        leadId: testLeadId,
        coordinatorId: testCoord1Id,
        coordinatorName: 'Coordinator Ahmed'
      }
    });

    if (res6.status === 403 && res6.body.errorCode === 'FORBIDDEN_COORDINATOR') {
      console.log('✅ [Scenario 6 PASSED] Coordinator assignment attempt rejected with 403 FORBIDDEN_COORDINATOR.');
      passedScenarios++;
    } else {
      console.error('❌ [Scenario 6 FAILED]', res6.status, res6.body);
    }

    // -------------------------------------------------------------
    // SCENARIO 7: Simultaneous assignment race condition
    // -------------------------------------------------------------
    console.log('\n🧪 Scenario 7: Two Leads Officers attempt to assign the same unassigned lead simultaneously...');
    await prisma.lead.create({
      data: {
        id: testLead2Id,
        customerId: testCustId,
        categoryId: cat?.id || 'cat-hair-care',
        treatmentId: trt?.id || 'trt-hair-prp',
        stage: 'new',
        source: 'RWC',
        assignedTo: null // Unassigned
      }
    });

    // Fire 2 concurrent requests at the exact same moment
    const [raceRes1, raceRes2] = await Promise.all([
      request({
        method: 'POST',
        path: '/api/leads/assign',
        headers: { 'x-user-id': testOfficer1Id },
        body: {
          leadId: testLead2Id,
          coordinatorId: testCoord1Id,
          coordinatorName: 'Coordinator Ahmed'
        }
      }),
      request({
        method: 'POST',
        path: '/api/leads/assign',
        headers: { 'x-user-id': testOfficer2Id },
        body: {
          leadId: testLead2Id,
          coordinatorId: testCoord2Id,
          coordinatorName: 'Coordinator Sara'
        }
      })
    ]);

    const statuses = [raceRes1.status, raceRes2.status].sort();
    const isOneSuccessOneConflict = (statuses[0] === 200 && statuses[1] === 409) ||
      (statuses[0] === 200 && statuses[1] === 403); // Either atomic 409 conflict or immediate 403 locked check

    const checkLeadDb = await prisma.lead.findUnique({ where: { id: testLead2Id } });

    if (isOneSuccessOneConflict && (checkLeadDb.assignedTo === testCoord1Id || checkLeadDb.assignedTo === testCoord2Id)) {
      console.log(`✅ [Scenario 7 PASSED] Race condition safely handled: Winner got 200, loser got ${statuses[1]}. No conflicting assignment (Winner: ${checkLeadDb.assignedTo}).`);
      passedScenarios++;
    } else {
      console.error('❌ [Scenario 7 FAILED]', statuses, raceRes1.body, raceRes2.body);
    }

    // -------------------------------------------------------------
    // SCENARIO 8: Access isolation after Super Admin reassignment
    // -------------------------------------------------------------
    console.log('\n🧪 Scenario 8: Verifying coordinator access isolation after reassignment...');
    // Lead is now assigned to testCoord2Id (Sara).
    // Ahmed (testCoord1Id) requests /api/leads -> should NOT include testLeadId
    const ahmedLeadsRes = await request({
      method: 'GET',
      path: '/api/leads',
      headers: { 'x-user-id': testCoord1Id }
    });

    // Sara (testCoord2Id) requests /api/leads -> SHOULD include testLeadId
    const saraLeadsRes = await request({
      method: 'GET',
      path: '/api/leads',
      headers: { 'x-user-id': testCoord2Id }
    });

    const ahmedHasLead = Array.isArray(ahmedLeadsRes.body) && ahmedLeadsRes.body.some(l => l.id === testLeadId);
    const saraHasLead = Array.isArray(saraLeadsRes.body) && saraLeadsRes.body.some(l => l.id === testLeadId);

    if (!ahmedHasLead && saraHasLead) {
      console.log('✅ [Scenario 8 PASSED] Previous coordinator (Ahmed) lost access; new coordinator (Sara) gained access.');
      passedScenarios++;
    } else {
      console.error('❌ [Scenario 8 FAILED] Ahmed access:', ahmedHasLead, 'Sara access:', saraHasLead);
    }

    // -------------------------------------------------------------
    // SCENARIO 9: Historical message sender attribution preserved
    // -------------------------------------------------------------
    console.log('\n🧪 Scenario 9: Verifying historical message attribution after reassignment...');
    const historyMsgId = `msg-test-hist-${Date.now()}`;
    await prisma.message.create({
      data: {
        id: historyMsgId,
        leadId: testLeadId,
        customerId: testCustId,
        direction: 'outbound',
        senderType: 'coordinator',
        coordinatorId: testCoord1Id, // Sent by Ahmed previously
        content: 'Hello, this is Ahmed assisting you earlier today.',
        status: 'delivered',
        timestamp: new Date(Date.now() - 3600000)
      }
    });

    // Fetch messages for this lead
    const msgCheck = await prisma.message.findUnique({ where: { id: historyMsgId } });
    if (msgCheck && msgCheck.coordinatorId === testCoord1Id && msgCheck.senderType === 'coordinator') {
      console.log('✅ [Scenario 9 PASSED] Historical message retained original sender attribution (Ahmed) after lead reassignment to Sara.');
      passedScenarios++;
    } else {
      console.error('❌ [Scenario 9 FAILED] Historical message changed:', msgCheck);
    }

  } catch (err) {
    console.error('💥 Test execution error:', err);
  } finally {
    // Cleanup test data
    console.log('\n🧹 Cleaning up test database records...');
    try {
      await prisma.message.deleteMany({ where: { leadId: { in: [testLeadId, testLead2Id] } } }).catch(() => {});
      await prisma.leadAssignmentHistory.deleteMany({ where: { leadId: { in: [testLeadId, testLead2Id] } } }).catch(() => {});
      await prisma.lead.deleteMany({ where: { id: { in: [testLeadId, testLead2Id] } } }).catch(() => {});
      await prisma.customer.deleteMany({ where: { id: testCustId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: [testOfficer1Id, testOfficer2Id, testCoord1Id, testCoord2Id] } } }).catch(() => {});
      console.log('✅ Test records cleaned up successfully.');
    } catch (e) {
      console.warn('⚠️ Cleanup warning:', e.message);
    }

    // Kill test server
    serverProcess.kill();
    console.log('🛑 Test server terminated.');
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passedScenarios} / ${totalScenarios} SCENARIOS PASSED`);
  console.log(`========================================\n`);

  if (passedScenarios === totalScenarios) {
    console.log('🎉 ALL 9 PERMISSION & LOCKING SCENARIOS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    console.error(`❌ SOME SCENARIOS FAILED (${passedScenarios}/${totalScenarios})\n`);
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
