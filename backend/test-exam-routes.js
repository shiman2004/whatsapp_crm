/**
 * Automated Verification Suite for Alpha Health Group Exam Department Module
 */
import assert from 'assert';
import { handleExamRoutes } from './src/examRoutes.js';
import EventEmitter from 'events';

console.log('🧪 Starting Exam Department Verification Suite...\n');

function createMockReq(method, path, body = null) {
  const req = new EventEmitter();
  req.method = method;
  req.url = path;
  req.headers = { 'content-type': 'application/json' };
  
  process.nextTick(() => {
    if (body) {
      req.emit('data', JSON.stringify(body));
    }
    req.emit('end');
  });
  
  return req;
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(chunk) {
      if (chunk) this.body += chunk;
      if (this.onEnd) {
        let parsed = null;
        try {
          parsed = this.body ? JSON.parse(this.body) : null;
        } catch (e) {
          parsed = this.body;
        }
        this.onEnd(this.statusCode, parsed);
      }
    }
  };
  return res;
}

function dispatchRoute(method, path, body = null, user = { id: 'admin', fullName: 'Admin', role: 'super_admin' }) {
  return new Promise((resolve) => {
    const req = createMockReq(method, path, body);
    const res = createMockRes();
    res.onEnd = (status, data) => resolve({ status, data });
    handleExamRoutes(req, res, path.split('?')[0], user);
  });
}

async function runTests() {
  console.log('--- Test 1: Authentication Guard ---');
  const unauthRes = await dispatchRoute('GET', '/api/exam/dashboard-stats', null, null);
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must be rejected with 401');
  console.log('✅ Unauthenticated requests safely blocked with 401');

  console.log('--- Test 2: Dashboard Stats ---');
  const statsRes = await dispatchRoute('GET', '/api/exam/dashboard-stats');
  assert.strictEqual(statsRes.status, 200, 'Stats endpoint should return 200');
  assert.strictEqual(statsRes.data.success, true);
  assert.ok(statsRes.data.data.pendingRequestsCount >= 5, 'Should have pending requests count matching screenshot');
  assert.ok(statsRes.data.data.totalExamsProvidedCount >= 128, 'Should have total exams provided matching screenshot');
  assert.ok(statsRes.data.data.totalStudyMaterialsCount >= 346, 'Should have total study materials matching screenshot');
  assert.ok(statsRes.data.data.totalMockTestsCount >= 278, 'Should have total mock tests matching screenshot');
  assert.ok(statsRes.data.data.recentRequests.length > 0, 'Should include recent requests');
  console.log('✅ Dashboard stats returned successfully with matching metrics');

  console.log('--- Test 3: Categories Listing ---');
  const catRes = await dispatchRoute('GET', '/api/exam/categories');
  assert.strictEqual(catRes.status, 200);
  const catCodes = catRes.data.data.map(c => c.code);
  assert.ok(catCodes.includes('DHA'), 'DHA category must exist');
  assert.ok(catCodes.includes('HAAD'), 'HAAD category must exist');
  assert.ok(catCodes.includes('MOH'), 'MOH category must exist');
  assert.ok(catCodes.includes('PROMETRIC'), 'Prometric category must exist');
  assert.ok(catCodes.includes('NCLEX'), 'NCLEX category must exist');
  assert.ok(catCodes.includes('OTHER'), 'Other Exams category must exist');
  console.log('✅ All 6 Exam categories exist (DHA, HAAD, MOH, Prometric, NCLEX, Other Exams)');

  console.log('--- Test 4: Create & Manage Material Request ---');
  const newReqRes = await dispatchRoute('POST', '/api/exam/requests', {
    title: 'Qatar Prometric Specialist Nurse Review',
    categoryId: 'cat-prometric',
    categoryName: 'Prometric',
    type: 'Study Material',
    requestedBy: 'Test Counsellor',
    candidateName: 'Zainab Ahmed',
    candidatePhone: '+971 52 999 8877',
    urgency: 'High',
    notes: 'Urgent candidate preparation requirement.'
  });
  assert.strictEqual(newReqRes.status, 201, 'Request creation should return 201');
  assert.strictEqual(newReqRes.data.data.status, 'Pending');
  const createdReqId = newReqRes.data.data.id;
  console.log(`✅ Material request created with ID: ${createdReqId}`);

  // Test status update
  const statusRes = await dispatchRoute('PATCH', `/api/exam/requests/${createdReqId}/status`, {
    status: 'Approved'
  });
  assert.strictEqual(statusRes.status, 200);
  console.log('✅ Material request status transitioned to Approved');

  console.log('--- Test 5: Upload Endpoint ---');
  const uploadRes = await dispatchRoute('POST', '/api/exam/upload', {
    fileName: 'dha_cardio_notes.pdf',
    dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrCg==',
    fileType: 'application/pdf',
    fileSize: 2048
  });
  assert.strictEqual(uploadRes.status, 200);
  assert.strictEqual(uploadRes.data.success, true);
  console.log(`✅ File upload processed: ${uploadRes.data.url}`);

  console.log('--- Test 6: Create Exam Material ---');
  const newMatRes = await dispatchRoute('POST', '/api/exam/materials', {
    title: 'DHA Cardiovascular Critical Care Guide 2026',
    categoryId: 'cat-dha',
    categoryName: 'DHA',
    type: 'Study Material',
    description: 'Specialist critical care nursing handbook.',
    fileName: uploadRes.data.fileName,
    fileUrl: uploadRes.data.url,
    fileType: 'application/pdf',
    fileSize: 2048,
    targetProfession: 'Critical Care Nurse'
  });
  assert.strictEqual(newMatRes.status, 201);
  console.log('✅ Exam material registered in repository');

  console.log('--- Test 7: Mock Test & Exam Provision Management ---');
  const mockRes = await dispatchRoute('GET', '/api/exam/mock-tests');
  assert.strictEqual(mockRes.status, 200);
  assert.ok(mockRes.data.data.length > 0);

  const provRes = await dispatchRoute('POST', '/api/exam/provisions', {
    candidateName: 'Zainab Ahmed',
    candidatePhone: '+971 52 999 8877',
    candidateEmail: 'zainab@example.com',
    categoryId: 'cat-dha',
    categoryName: 'DHA',
    packageName: 'DHA RN Complete Prep Pack',
    notes: 'Granted full mock access'
  });
  assert.strictEqual(provRes.status, 201);
  console.log('✅ Exam access provisioned successfully');

  console.log('\n🎉 ALL EXAM DEPARTMENT BACKEND TESTS PASSED (7/7)!');
}

runTests().catch(err => {
  console.error('❌ Test failure:', err);
  process.exit(1);
});
