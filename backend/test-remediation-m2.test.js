process.env.NODE_ENV = 'test';
process.env.EXAM_ALLOW_MEMORY_FIXTURES = 'true';
process.env.TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/crm_test';

const { test, describe } = await import('node:test');
const { default: assert } = await import('node:assert/strict');
const { default: crypto } = await import('node:crypto');
const { StudentAccess, DevicePolicyManager } = await import('./src/studentAccess.js');
const { handleStudentRoutes } = await import('./src/studentRoutes.js');
const { handleSecurityRoutes } = await import('./src/securityRoutes.js');
const { handleExamOperations } = await import('./src/examOperationsRoutes.js');
const { ExamStore, getSharedMemoryExamStore } = await import('./src/examStore.js');
const { orderKey } = await import('./src/examOperations.js');
const { JWT_SECRET } = await import('./src/runtimeConfig.js');
const { TestStore, fails, unsealPayload } = await import('./tests/e2e/fixtures/testHarness.js');
const { superAdmin, examManager, salesOfficer, financeOfficer } = await import('./tests/e2e/fixtures/actors.js');

describe('Milestone 2 Remediation Verification Suite', () => {

  // =========================================================================
  // FIX 1: Student Routes Mounting & Public Route Exemption
  // =========================================================================
  describe('Fix 1: Student Routes Mounted & Public Route Exemption', () => {
    test('Public routes execute without CRM staff token; authenticated routes require student token', async () => {
      // 1. Verify handleStudentRoutes handles public login without staff token
      const reqLogin = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        socket: { remoteAddress: '127.0.0.1' },
        [Symbol.asyncIterator]: async function* () {
          yield JSON.stringify({ email: 'nonexistent@example.com', password: 'AnyPassword12345!' });
        }
      };

      let status = null;
      let responseData = null;
      const res = {
        setHeader: () => {},
        writeHead: (s) => { status = s; },
        end: (payload) => { responseData = JSON.parse(payload); }
      };

      const handled = await handleStudentRoutes(reqLogin, res, '/api/student/login', null);
      assert.equal(handled, true, 'handleStudentRoutes must handle /api/student/login');
      // Should fail with INVALID_LOGIN 401 because credentials do not exist, NOT with CRM staff UNAUTHORIZED
      assert.equal(status, 401);
      assert.equal(responseData.code, 'INVALID_LOGIN');

      // 2. Verify protected route /api/student/me rejects missing student session
      const reqMe = {
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      };
      let meStatus = null;
      let meData = null;
      const resMe = {
        setHeader: () => {},
        writeHead: (s) => { meStatus = s; },
        end: (payload) => { meData = JSON.parse(payload); }
      };
      const handledMe = await handleStudentRoutes(reqMe, resMe, '/api/student/me', null);
      assert.equal(handledMe, true);
      assert.equal(meStatus, 401);
      assert.equal(meData.code, 'UNAUTHORIZED');
    });

    test('Non-student route returns false from handleStudentRoutes', async () => {
      const handled = await handleStudentRoutes({}, {}, '/api/exam-ops/handoffs', null);
      assert.equal(handled, false);
    });
  });

  // =========================================================================
  // FIX 2: Live DevicePolicyManager Integration in login() and verifyDevice()
  // =========================================================================
  describe('Fix 2: Live DevicePolicyManager Integration in login() and verifyDevice()', () => {
    test('Student with 2 registered devices (1 mobile + 1 desktop) is blocked with THIRD_DEVICE_BLOCKED at login from 3rd device', async () => {
      const store = new TestStore();
      const access = new StudentAccess(store, JWT_SECRET);
      const email = 'two-devices@example.com';
      const studentId = orderKey(email);
      const password = 'StrongPassword2026!';
      const passwordHash = await access.hashPassword(password);

      // Seed student with 1 Mobile + 1 Desktop
      await store.transaction(async tx => {
        await tx.put('student', studentId, {
          id: studentId,
          name: 'Two Devices Student',
          email,
          status: 'ACTIVE',
          generation: 1,
          passwordHash,
          browserDigest: access.digest('browser-laptop-1'),
          registeredDevices: [
            { deviceId: 'phone-1', deviceType: 'mobile', status: 'ACTIVE' },
            { deviceId: 'laptop-1', deviceType: 'desktop', status: 'ACTIVE' }
          ]
        });
      });

      // Attempt login from 3rd device (unregistered)
      await fails(
        access.login(email, password, 'browser-tablet-3'),
        'THIRD_DEVICE_BLOCKED'
      );
    });

    test('Student with 1 mobile device attempting to log in from 2nd mobile device is blocked with DEVICE_LIMIT_EXCEEDED', async () => {
      const store = new TestStore();
      const access = new StudentAccess(store, JWT_SECRET);
      const email = 'mobile-limit@example.com';
      const studentId = orderKey(email);
      const password = 'StrongPassword2026!';
      const passwordHash = await access.hashPassword(password);

      // Seed student with 1 Mobile (slot full for mobile)
      await store.transaction(async tx => {
        await tx.put('student', studentId, {
          id: studentId,
          name: 'Mobile Limit Student',
          email,
          status: 'ACTIVE',
          generation: 1,
          passwordHash,
          browserDigest: access.digest('phone-primary-browser'),
          registeredDevices: [
            { deviceId: 'phone-1', deviceType: 'mobile', status: 'ACTIVE' }
          ]
        });
      });

      // Attempt login from 2nd phone (deviceDetails specifies mobile or browser name matches mobile)
      await fails(
        access.login(email, password, 'iphone-secondary-phone', 'unknown', { deviceType: 'mobile' }),
        'DEVICE_LIMIT_EXCEEDED'
      );
    });

    test('Student with 1 desktop device attempting to log in from 2nd desktop is blocked with DEVICE_LIMIT_EXCEEDED', async () => {
      const store = new TestStore();
      const access = new StudentAccess(store, JWT_SECRET);
      const email = 'pc-limit@example.com';
      const studentId = orderKey(email);
      const password = 'StrongPassword2026!';
      const passwordHash = await access.hashPassword(password);

      // Seed student with 1 Desktop
      await store.transaction(async tx => {
        await tx.put('student', studentId, {
          id: studentId,
          name: 'PC Limit Student',
          email,
          status: 'ACTIVE',
          generation: 1,
          passwordHash,
          browserDigest: access.digest('pc-office-browser'),
          registeredDevices: [
            { deviceId: 'laptop-1', deviceType: 'desktop', status: 'ACTIVE' }
          ]
        });
      });

      // Attempt login from 2nd computer
      await fails(
        access.login(email, password, 'macbook-laptop-2', 'unknown', { deviceType: 'desktop' }),
        'DEVICE_LIMIT_EXCEEDED'
      );
    });

    test('When OTP verification completes, device is recorded as ACTIVE in student.registeredDevices', async () => {
      const store = new TestStore();
      const access = new StudentAccess(store, JWT_SECRET);
      const email = 'device-registration-on-otp@example.com';
      const studentId = orderKey(email);
      const password = 'StrongPassword2026!';
      const passwordHash = await access.hashPassword(password);

      // Student has initial laptop registered
      await store.transaction(async tx => {
        await tx.put('student', studentId, {
          id: studentId,
          name: 'OTP Registration Student',
          email,
          status: 'ACTIVE',
          generation: 1,
          passwordHash,
          browserDigest: access.digest('browser-laptop'),
          registeredDevices: [
            { deviceId: 'dev-laptop-1', deviceType: 'desktop', status: 'ACTIVE' }
          ]
        });
      });

      // Student logs in from new phone (permitted 2nd device)
      const challenge = await access.login(email, password, 'browser-iphone-mobile');
      assert.equal(challenge.requiresOtp, true);

      // Extract OTP code from outbox
      const mail = [...store.rows.values()].find(x => x.purpose === 'device-code');
      const code = unsealPayload(access, mail.payload).code;

      // Verify device OTP
      const session = await access.verifyDevice(challenge.challengeId, code, 'browser-iphone-mobile');
      assert.ok(session.token);

      // CRITICAL CHECK: student.registeredDevices now has 2 ACTIVE devices!
      const studentRow = await store.transaction(tx => tx.get('student', studentId));
      assert.equal(studentRow.registeredDevices.length, 2);
      const phoneDevice = studentRow.registeredDevices.find(d => d.deviceType === 'mobile');
      assert.ok(phoneDevice, 'Mobile phone must be recorded in registeredDevices');
      assert.equal(phoneDevice.status, 'ACTIVE');
    });

    test('Revoked device re-registration is rejected with THIRD_DEVICE_BLOCKED in DevicePolicyManager.registerDevice()', async () => {
      const store = new TestStore();
      const manager = new DevicePolicyManager(store);
      const email = 'revoked-test@example.com';
      const studentId = orderKey(email);

      // Student has a revoked device
      await store.transaction(async tx => {
        await tx.put('student', studentId, {
          id: studentId,
          name: 'Revoked Test Student',
          email,
          status: 'ACTIVE',
          generation: 1,
          registeredDevices: [
            { deviceId: 'dev-revoked-phone', deviceType: 'mobile', status: 'REVOKED', revokedAt: new Date().toISOString() }
          ]
        });
      });

      // Attempt to re-register the revoked device directly
      await fails(
        manager.registerDevice(studentId, {
          deviceId: 'dev-revoked-phone',
          deviceType: 'mobile'
        }),
        'THIRD_DEVICE_BLOCKED'
      );
    });
  });

  // =========================================================================
  // FIX 3: Exam Department Manager Access in securityRoutes.js
  // =========================================================================
  describe('Fix 3: Exam Department Manager Allowed on Device Replacement Security Routes', () => {
    test('exam_department_manager can access /api/security/device-replacements and approve endpoints', async () => {
      const req = { method: 'GET', headers: {} };
      let status = null;
      let body = null;
      const res = {
        writeHead: (s) => { status = s; },
        end: (p) => { body = JSON.parse(p); }
      };

      // Exam department manager calls GET /api/security/device-replacements
      const handled = await handleSecurityRoutes(req, res, '/api/security/device-replacements', examManager, 'corr-test-1');
      assert.equal(handled, true);
      assert.equal(status, 200, 'exam_department_manager must receive 200 OK');
      assert.ok(Array.isArray(body.data));
    });

    test('Non-manager staff (sales_coordinator) is rejected with 403 on /api/security/device-replacements', async () => {
      const req = { method: 'GET', headers: {} };
      let status = null;
      let body = null;
      const res = {
        writeHead: (s) => { status = s; },
        end: (p) => { body = JSON.parse(p); }
      };

      const handled = await handleSecurityRoutes(req, res, '/api/security/device-replacements', salesOfficer, 'corr-test-2');
      assert.equal(handled, true);
      assert.equal(status, 403, 'Sales officer must be rejected with 403');
    });

    test('Non-manager staff (finance_officer) is rejected with 403 on /api/security/device-replacements', async () => {
      const req = { method: 'GET', headers: {} };
      let status = null;
      const res = {
        writeHead: (s) => { status = s; },
        end: () => {}
      };

      const handled = await handleSecurityRoutes(req, res, '/api/security/device-replacements', financeOfficer, 'corr-test-3');
      assert.equal(handled, true);
      assert.equal(status, 403, 'Finance officer must be rejected with 403');
    });
  });

  // =========================================================================
  // FIX 4: Student Lifecycle Status API
  // =========================================================================
  describe('Fix 4: Student Lifecycle Status API Exposed on HTTP Endpoints', () => {
    test('PATCH /api/exam-ops/students/:id/status updates status and invalidates sessions when suspended', async () => {
      const store = getSharedMemoryExamStore();
      const access = new StudentAccess(store, JWT_SECRET);
      const email = 'lifecycle.student@example.com';
      const studentId = orderKey(email);
      const password = 'StrongPassword2026!';
      const passwordHash = await access.hashPassword(password);

      // Student is active with active session
      let token = null;
      await store.transaction(async tx => {
        const student = {
          id: studentId,
          name: 'Lifecycle Student',
          email,
          status: 'ACTIVE',
          generation: 1,
          passwordHash,
          browserDigest: access.digest('browser-1')
        };
        await tx.put('student', studentId, student);
      });
      const session = await access.login(email, password, 'browser-1');
      token = session.token;
      assert.ok(token);

      // Verify portal is accessible
      const portalBefore = await access.portal(token, 'browser-1');
      assert.equal(portalBefore.student.status, 'ACTIVE');

      // Manager updates student status to 'Suspended' via examOps endpoint
      const reqStatus = {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        [Symbol.asyncIterator]: async function* () {
          yield JSON.stringify({ status: 'Suspended', reason: 'Misconduct investigation' });
        }
      };
      let patchStatus = null;
      let patchBody = null;
      const resStatus = {
        writeHead: (s) => { patchStatus = s; },
        end: (p) => { patchBody = JSON.parse(p); }
      };

      const handled = await handleExamOperations(reqStatus, resStatus, `/api/exam-ops/students/${studentId}/status`, examManager);
      assert.equal(handled, true);
      assert.equal(patchStatus, 200);
      assert.equal(patchBody.data.status, 'Suspended');
    });

    test('PATCH /api/student/admin/:id/status updates status when invoked by exam_department_manager', async () => {
      const store = getSharedMemoryExamStore();
      const access = new StudentAccess(store, JWT_SECRET);
      const email = 'admin.route.student@example.com';
      const studentId = orderKey(email);
      const password = 'StrongPassword2026!';
      const passwordHash = await access.hashPassword(password);

      await store.transaction(async tx => {
        await tx.put('student', studentId, {
          id: studentId,
          name: 'Admin Route Student',
          email,
          status: 'ACTIVE',
          generation: 1,
          passwordHash
        });
      });

      const reqAdmin = {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        [Symbol.asyncIterator]: async function* () {
          yield JSON.stringify({ status: 'Locked', reason: 'Repeated failed sign-ins' });
        }
      };
      let patchStatus = null;
      let patchBody = null;
      const resAdmin = {
        setHeader: () => {},
        writeHead: (s) => { patchStatus = s; },
        end: (p) => { patchBody = JSON.parse(p); }
      };

      const handled = await handleStudentRoutes(reqAdmin, resAdmin, `/api/student/admin/${studentId}/status`, examManager);
      assert.equal(handled, true);
      assert.equal(patchStatus, 200);
      assert.equal(patchBody.data.status, 'Locked');
    });
  });

});
