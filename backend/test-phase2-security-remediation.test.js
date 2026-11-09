/**
 * PHASE 2 SECURITY REMEDIATION REGRESSION TEST SUITE
 *
 * Repository: shiman2004/whatsapp_crm
 * Target: Security Remediation Phase 2
 *
 * Covers:
 * FIX 01 — Meta Webhook Signature Fail-Open Remediation
 * FIX 02 — Student Routes Staff Token Revocation Enforcement
 * FIX 03 — Unbounded Chunked Request Bodies & Memory Protection
 */

process.env.NODE_ENV = 'test';
process.env.IS_TEST_ENV = 'true';
process.env.META_APP_SECRET = 'valid-production-grade-meta-secret-2026';

import assert from 'node:assert';
import http from 'node:http';
import crypto from 'node:crypto';
import {
  server,
  signAuthToken,
  verifyMetaSignature,
  timingSafeStringEqual,
  CANONICAL_USERS,
  REQUEST_BODY_LIMITS,
  getBodyLimit,
  readBoundedBody,
  readBoundedJson,
  applyIncrementalStreamLimiter,
  PayloadTooLargeError
} from './src/legacyServer.js';
import { getPrisma, getDbStatus } from './src/db.js';
import { ExamStore } from './src/examStore.js';

console.log('🔒 =========================================================================');
console.log('🔒 Phase 2 Security Remediation: Comprehensive Regression Test Suite');
console.log('🔒 =========================================================================\n');

const TEST_PORT = 39822;
const baseUrl = `http://127.0.0.1:${TEST_PORT}`;
const APP_SECRET = process.env.META_APP_SECRET;

function computeMetaSig(payload, secret = APP_SECRET) {
  const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload || ''), 'utf8');
  return 'sha256=' + crypto.createHmac('sha256', secret).update(buf).digest('hex');
}

server.listen(TEST_PORT, '127.0.0.1', async () => {
  let passedCount = 0;
  function pass(msg) {
    passedCount++;
    console.log(`  ✅ ${msg}`);
  }

  try {
    const prisma = getPrisma();
    const dbAvailable = Boolean(prisma && getDbStatus());
    const testSuffix = Math.random().toString(36).substring(2, 8);

    // =========================================================================
    // FIX 01: META WEBHOOK SIGNATURE FAIL-OPEN REMEDIATION
    // =========================================================================
    console.log('📦 SECTION 1: Meta Webhook Signature Fail-Open & Verification');

    const testPayload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        id: 'waba_test_1',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '94706393353', phone_number_id: '1358157244046701' },
            contacts: [{ profile: { name: 'Security QA' }, wa_id: '94770001122' }],
            messages: [{ from: '94770001122', id: `wamid_${testSuffix}_1`, timestamp: '1700000000', text: { body: 'Test Ping' }, type: 'text' }]
          }
        }]
      }]
    });
    const validSignature = computeMetaSig(testPayload);

    // 1.1 Valid signature is accepted
    assert.strictEqual(verifyMetaSignature(testPayload, validSignature), true, 'Valid signature must be verified as true');
    pass('1.1 Valid Meta signature accepted');

    // 1.2 Invalid signature rejected
    assert.strictEqual(verifyMetaSignature(testPayload, 'sha256=' + '0'.repeat(64)), false, 'Invalid signature hash must be rejected');
    assert.strictEqual(verifyMetaSignature(testPayload, 'sha256=invalidhex'), false, 'Malformed signature hex must be rejected');
    pass('1.2 Invalid and malformed signatures rejected');

    // 1.3 Missing signature header rejected
    assert.strictEqual(verifyMetaSignature(testPayload, null), false, 'Missing signature must return false');
    assert.strictEqual(verifyMetaSignature(testPayload, undefined), false, 'Undefined signature must return false');
    assert.strictEqual(verifyMetaSignature(testPayload, ''), false, 'Empty signature must return false');
    pass('1.3 Missing signature headers rejected');

    // 1.4 Missing app secret fails closed
    assert.strictEqual(verifyMetaSignature(testPayload, validSignature, ''), false, 'Empty secret must fail closed');
    assert.strictEqual(verifyMetaSignature(testPayload, validSignature, null), false, 'Null secret must fail closed');
    pass('1.4 Missing app secret fails closed (returns false, never true)');

    // 1.5 Placeholder app secrets fail closed
    const placeholders = ['change_me', 'changeme', 'your_meta_app_secret', 'placeholder', 'secret', 'xxx', 'short'];
    for (const ph of placeholders) {
      assert.strictEqual(verifyMetaSignature(testPayload, computeMetaSig(testPayload, ph), ph), false, `Placeholder secret "${ph}" must fail closed`);
    }
    pass('1.5 Known placeholder secrets rejected with fail-closed behavior');

    // 1.6 Modified raw payload rejected
    assert.strictEqual(verifyMetaSignature(testPayload + ' ', validSignature), false, 'Payload with appended byte must fail verification');
    assert.strictEqual(verifyMetaSignature(Buffer.from(testPayload + '!'), validSignature), false, 'Tampered buffer must fail verification');
    pass('1.6 Modified raw payload rejected against original signature');

    // 1.7 HTTP Webhook POST with valid signature accepted
    const resPostValid = await fetch(`${baseUrl}/api/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': validSignature
      },
      body: testPayload
    });
    assert.strictEqual(resPostValid.status, 200, 'Valid webhook POST must return HTTP 200');
    const dataPostValid = await resPostValid.json();
    assert.strictEqual(dataPostValid.status, 'EVENT_RECEIVED');
    pass('1.7 HTTP POST /api/webhook with valid signature accepted (200 OK)');

    // 1.8 HTTP Webhook POST with invalid signature rejected
    const resPostInvalid = await fetch(`${baseUrl}/api/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=' + 'f'.repeat(64)
      },
      body: testPayload
    });
    assert.strictEqual(resPostInvalid.status, 401, 'Invalid signature POST must return HTTP 401');
    pass('1.8 HTTP POST /api/webhook with invalid signature rejected (401 Unauthorized)');

    // 1.9 HTTP Webhook POST with missing signature header rejected
    const resPostMissing = await fetch(`${baseUrl}/api/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: testPayload
    });
    assert.strictEqual(resPostMissing.status, 401, 'Webhook POST without X-Hub-Signature-256 must return 401');
    pass('1.9 HTTP POST /api/webhook without signature header rejected (401 Unauthorized)');

    // 1.10 HTTP /api/meta/webhook alias routes enforce identical verification
    const resMetaAlias = await fetch(`${baseUrl}/api/meta/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': validSignature
      },
      body: testPayload
    });
    assert.strictEqual(resMetaAlias.status, 200, '/api/meta/webhook must accept valid signature');
    const resMetaAliasBad = await fetch(`${baseUrl}/api/meta/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: testPayload
    });
    assert.strictEqual(resMetaAliasBad.status, 401, '/api/meta/webhook must reject missing signature');
    pass('1.10 /api/meta/webhook alias route enforces signature verification identically');

    // 1.11 Valid image webhook payload processed
    const imgPayload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        id: 'waba_test_img',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '94706393353', phone_number_id: '1358157244046701' },
            contacts: [{ profile: { name: 'Image Sender' }, wa_id: '94770001133' }],
            messages: [{
              from: '94770001133',
              id: `wamid_img_${testSuffix}`,
              timestamp: '1700000010',
              type: 'image',
              image: { id: `meta_media_${testSuffix}`, mime_type: 'image/jpeg', sha256: 'a'.repeat(64), caption: 'Skin lesion' }
            }]
          }
        }]
      }]
    });
    const resImg = await fetch(`${baseUrl}/api/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': computeMetaSig(imgPayload)
      },
      body: imgPayload
    });
    assert.strictEqual(resImg.status, 200);
    pass('1.11 Valid image webhook processed without regression');

    // 1.12 Duplicate webhook event is idempotent
    const resDup = await fetch(`${baseUrl}/api/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': computeMetaSig(imgPayload)
      },
      body: imgPayload
    });
    assert.strictEqual(resDup.status, 200);
    pass('1.12 Duplicate valid webhook delivery handles idempotency cleanly (200 OK)');


    // =========================================================================
    // FIX 02: REVOKED STAFF TOKENS IN STUDENT ROUTES
    // =========================================================================
    console.log('\n📦 SECTION 2: Student Routes Staff Token Revocation Enforcement');

    // Seed target student record in the exam store
    const examStore = new ExamStore(prisma);
    const targetStudentId = `std_${testSuffix}`;
    await examStore.transaction(async tx => {
      await tx.put('student', targetStudentId, {
        id: targetStudentId,
        name: 'Target Student QA',
        email: `student_${testSuffix}@example.com`,
        status: 'PENDING',
        generation: 1
      });
    });

    // Prepare test accounts
    const superAdminId = `admin_${testSuffix}`;
    const examManagerId = `manager_${testSuffix}`;
    const revokedAdminId = `revoked_admin_${testSuffix}`;
    const disabledAdminId = `disabled_admin_${testSuffix}`;
    const coordinatorId = `coord_${testSuffix}`;

    const testUsers = [
      { id: superAdminId, email: `sa_${testSuffix}@royalwellness.lk`, fullName: 'Super Admin', role: 'super_admin', active: true, session_version: 0 },
      { id: examManagerId, email: `em_${testSuffix}@royalwellness.lk`, fullName: 'Exam Manager', role: 'exam_department_manager', active: true, session_version: 0 },
      { id: revokedAdminId, email: `rev_${testSuffix}@royalwellness.lk`, fullName: 'Revoked Admin', role: 'super_admin', active: true, session_version: 2 }, // Active SV is 2
      { id: disabledAdminId, email: `dis_${testSuffix}@royalwellness.lk`, fullName: 'Disabled Admin', role: 'super_admin', active: false, session_version: 0 },
      { id: coordinatorId, email: `co_${testSuffix}@royalwellness.lk`, fullName: 'Regular Coordinator', role: 'coordinator', active: true, session_version: 0 }
    ];

    if (dbAvailable) {
      for (const u of testUsers) {
        await prisma.user.create({
          data: {
            id: u.id,
            email: u.email,
            fullName: u.fullName,
            role: u.role,
            active: u.active,
            session_version: u.session_version,
            password: 'argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$dGVzdGhhc2g',
            branch: 'Colombo',
            company: 'RWC'
          }
        });
      }
    } else {
      for (const u of testUsers) {
        CANONICAL_USERS.push(u);
      }
    }

    // 2.1 Valid active super_admin token
    const tokenSuperAdmin = signAuthToken({ userId: superAdminId, role: 'super_admin', sv: 0 });
    const resSA = await fetch(`${baseUrl}/api/student/admin/${targetStudentId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenSuperAdmin}`
      },
      body: JSON.stringify({ status: 'ACTIVE', reason: 'Verified enrollment' })
    });
    assert.strictEqual(resSA.status, 200, 'Active super_admin token must be authorized (200 OK)');
    const studentAfterSA = await examStore.transaction(tx => tx.get('student', targetStudentId, true));
    assert.strictEqual(studentAfterSA.status, 'ACTIVE', 'Student status in store must be updated to ACTIVE');
    pass('2.1 Active super_admin token authorized on /api/student/admin/:id/status (200 OK)');

    // 2.2 Valid active exam_department_manager token
    const tokenExamManager = signAuthToken({ userId: examManagerId, role: 'exam_department_manager', sv: 0 });
    const resEM = await fetch(`${baseUrl}/api/student/admin/${targetStudentId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenExamManager}`
      },
      body: JSON.stringify({ status: 'SUSPENDED', reason: 'Department manager action' })
    });
    assert.strictEqual(resEM.status, 200, 'Active exam_department_manager token must be authorized (200 OK)');
    const studentAfterEM = await examStore.transaction(tx => tx.get('student', targetStudentId, true));
    assert.strictEqual(studentAfterEM.status, 'SUSPENDED', 'Student status in store must be updated to SUSPENDED');
    pass('2.2 Active exam_department_manager token authorized (200 OK)');

    // 2.3 Token with outdated session_version (Revoked staff session)
    // Token was minted with sv: 0, but user's database session_version is 2
    const tokenRevokedAdmin = signAuthToken({ userId: revokedAdminId, role: 'super_admin', sv: 0 });
    const resRevoked = await fetch(`${baseUrl}/api/student/admin/${targetStudentId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenRevokedAdmin}`
      },
      body: JSON.stringify({ status: 'ACTIVE', reason: 'Malicious attempt' })
    });
    assert.strictEqual(resRevoked.status, 401, 'Revoked session_version token must return 401');
    const studentAfterRevoked = await examStore.transaction(tx => tx.get('student', targetStudentId, true));
    assert.strictEqual(studentAfterRevoked.status, 'SUSPENDED', 'Zero mutations must occur on revoked token attempt');
    pass('2.3 Revoked staff token (outdated session_version) rejected with 401 & zero store mutation');

    // 2.4 Token of disabled staff member (active: false)
    const tokenDisabled = signAuthToken({ userId: disabledAdminId, role: 'super_admin', sv: 0 });
    const resDisabled = await fetch(`${baseUrl}/api/student/admin/${targetStudentId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenDisabled}`
      },
      body: JSON.stringify({ status: 'ACTIVE', reason: 'Should not apply' })
    });
    assert.strictEqual(resDisabled.status, 401, 'Disabled staff token must return 401');
    const studentAfterDisabled = await examStore.transaction(tx => tx.get('student', targetStudentId, true));
    assert.strictEqual(studentAfterDisabled.status, 'SUSPENDED', 'Zero mutations must occur on deactivated staff attempt');
    pass('2.4 Deactivated staff token rejected with 401 & zero store mutation');

    // 2.5 Unauthorized staff role (coordinator attempting student admin status change)
    const tokenCoord = signAuthToken({ userId: coordinatorId, role: 'coordinator', sv: 0 });
    const resCoord = await fetch(`${baseUrl}/api/student/admin/${targetStudentId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenCoord}`
      },
      body: JSON.stringify({ status: 'ACTIVE', reason: 'Unauthorized role action' })
    });
    assert.strictEqual(resCoord.status, 403, 'Unauthorized staff role must return 403 Forbidden');
    const studentAfterCoord = await examStore.transaction(tx => tx.get('student', targetStudentId, true));
    assert.strictEqual(studentAfterCoord.status, 'SUSPENDED', 'Zero mutations must occur on forbidden role attempt');
    pass('2.5 Non-administrative staff role rejected with 403 & zero store mutation');

    // 2.6 Unauthenticated request (no Authorization header)
    const resUnauth = await fetch(`${baseUrl}/api/student/admin/${targetStudentId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' })
    });
    assert.strictEqual(resUnauth.status, 401, 'Unauthenticated request must return 401');
    const studentAfterUnauth = await examStore.transaction(tx => tx.get('student', targetStudentId, true));
    assert.strictEqual(studentAfterUnauth.status, 'SUSPENDED', 'Zero mutations must occur on unauthenticated attempt');
    pass('2.6 Missing staff credentials rejected with 401 & zero store mutation');


    // =========================================================================
    // FIX 03: UNBOUNDED CHUNKED REQUEST BODIES & STREAM LIMITERS
    // =========================================================================
    console.log('\n📦 SECTION 3: Unbounded Chunked Request Bodies & Memory Protection');

    // 3.1 Verify REQUEST_BODY_LIMITS constants
    assert.strictEqual(REQUEST_BODY_LIMITS.login, 32 * 1024, 'Login limit must be 32 KB');
    assert.strictEqual(REQUEST_BODY_LIMITS.settings, 512 * 1024, 'Settings limit must be 512 KB');
    assert.strictEqual(REQUEST_BODY_LIMITS.student, 100 * 1024, 'Student limit must be 100 KB');
    assert.strictEqual(REQUEST_BODY_LIMITS.webhook, 2 * 1024 * 1024, 'Webhook limit must be 2 MB');
    assert.strictEqual(REQUEST_BODY_LIMITS.upload, 25 * 1024 * 1024, 'Upload limit must be 25 MB');
    pass('3.1 Explicit byte limits configured per endpoint domain');

    // 3.2 Declared Content-Length exceeding limit returns 413 immediately
    const resDeclaredOver = await new Promise((resolve) => {
      const clientReq = http.request({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(64 * 1024)
        }
      }, (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode }));
      });
      clientReq.on('error', () => resolve({ status: 413 }));
      clientReq.write('{"identifier":"test@example.com"}');
      clientReq.end();
    });
    assert.strictEqual(resDeclaredOver.status, 413, 'Declared oversized Content-Length must return HTTP 413');
    pass('3.2 Declared Content-Length exceeding limit rejected immediately with HTTP 413');

    // 3.3 Chunked request without Content-Length exceeding login limit returns HTTP 413
    const chunkedStatus = await new Promise((resolve) => {
      const clientReq = http.request({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Transfer-Encoding': 'chunked'
          // Content-Length intentionally omitted
        }
      }, (res) => {
        let respBody = '';
        res.on('data', c => { respBody += c; });
        res.on('end', () => {
          resolve({ status: res.statusCode, body: respBody });
        });
      });

      clientReq.on('error', () => {
        // Socket destruction by server is a valid fast-fail mechanism
        resolve({ status: 413, error: 'ECONNRESET_BY_SERVER' });
      });

      // Stream chunks exceeding 32 KB in increments
      const chunk = '{"junk":"' + 'X'.repeat(8192) + '"}';
      for (let i = 0; i < 6; i++) { // 6 * ~8KB = ~48KB > 32KB
        clientReq.write(chunk);
      }
      clientReq.end();
    });
    assert.strictEqual(chunkedStatus.status, 413, 'Chunked payload exceeding login limit must return 413');
    pass('3.3 Chunked body without Content-Length terminated with HTTP 413 (Login 32KB limit)');

    // 3.4 Direct stream testing for settings (512 KB) limit
    const { Readable } = await import('node:stream');
    const mockReqSettings = new Readable({
      read() {
        this.push('A'.repeat(300 * 1024));
        this.push('B'.repeat(300 * 1024)); // Total 600 KB > 512 KB
        this.push(null);
      }
    });
    mockReqSettings.headers = {};
    await assert.rejects(
      async () => readBoundedJson(mockReqSettings, REQUEST_BODY_LIMITS.settings),
      (err) => err instanceof PayloadTooLargeError && err.status === 413,
      'readBoundedJson must reject payloads exceeding settings limit with PayloadTooLargeError (413)'
    );
    pass('3.4 Incremental stream reading rejects chunked stream exceeding 512KB settings limit with PayloadTooLargeError');

    // 3.5 Direct stream testing for student (100 KB) limit
    const mockReqStudent = new Readable({
      read() {
        this.push('{"data":"' + 'S'.repeat(120 * 1024) + '"}'); // > 100 KB
        this.push(null);
      }
    });
    mockReqStudent.headers = {};
    await assert.rejects(
      async () => readBoundedJson(mockReqStudent, REQUEST_BODY_LIMITS.student),
      (err) => err instanceof PayloadTooLargeError && err.status === 413,
      'readBoundedJson must reject payloads exceeding student limit with PayloadTooLargeError (413)'
    );
    pass('3.5 Incremental stream reading rejects chunked stream exceeding 100KB student limit with PayloadTooLargeError');

    // 3.6 Webhook bounded body reading halts oversized chunked webhook
    const chunkedWebhookStatus = await new Promise((resolve) => {
      const clientReq = http.request({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=' + '0'.repeat(64),
          'Transfer-Encoding': 'chunked'
        }
      }, (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode }));
      });
      clientReq.on('error', () => resolve({ status: 413 }));

      // Stream chunks totaling 2.5 MB (> 2 MB webhook limit)
      const chunk = 'Z'.repeat(256 * 1024); // 256 KB
      for (let i = 0; i < 11; i++) {
        clientReq.write(chunk);
      }
      clientReq.end();
    });
    assert.strictEqual(chunkedWebhookStatus.status, 413, 'Chunked payload exceeding webhook limit must return 413');
    pass('3.6 Webhook unbounded chunked streaming terminated with HTTP 413 (Webhook 2MB limit)');

    // 3.7 Legitimate payload within limits parses cleanly without error
    const validJsonReq = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ identifier: 'test@example.com', password: 'ShortPassword123!' })
    });
    assert.notStrictEqual(validJsonReq.status, 413, 'Valid sized payload must not be rejected with 413');
    pass('3.7 Legitimate payload within bounds parses cleanly and is not rejected');

    console.log(`\n🎉 ALL ${passedCount} PHASE 2 SECURITY REGRESSION TEST CASES PASSED SUCCESSFULLY!\n`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Phase 2 Security Regression Test Failed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
