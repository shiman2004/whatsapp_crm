process.env.NODE_ENV = 'test';
process.env.EXAM_ALLOW_MEMORY_FIXTURES = 'true';
process.env.TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/crm_test';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/crm_test';

const { test, describe, before, after } = await import('node:test');
const { default: assert } = await import('node:assert/strict');
const { default: crypto } = await import('node:crypto');
const { StudentAccess, DevicePolicyManager } = await import('./src/studentAccess.js');
const { handleStudentRoutes } = await import('./src/studentRoutes.js');
const { handleExamOperations } = await import('./src/examOperationsRoutes.js');
const { getSharedMemoryExamStore } = await import('./src/examStore.js');
const { orderKey } = await import('./src/examOperations.js');
const { JWT_SECRET } = await import('./src/runtimeConfig.js');
const { TestStore, fails, unsealPayload } = await import('./tests/e2e/fixtures/testHarness.js');
const { server, signAuthToken } = await import('./src/legacyServer.js');

describe('Milestone 2 Remediation Adversarial Stress Harness', () => {
  let serverPort;
  let serverUrl;
  const store = getSharedMemoryExamStore();
  const access = new StudentAccess(store, JWT_SECRET);
  const manager = new DevicePolicyManager(store, JWT_SECRET, access);

  const makeBrowser = (label = 'test') => `browser-${label}-${crypto.randomBytes(24).toString('base64url')}`;

  const superAdminToken = signAuthToken({
    userId: 'user-admin-1',
    email: 'admin@royalwellness.lk',
    role: 'super_admin',
    fullName: 'Super Administrator'
  });

  const examManagerToken = signAuthToken({
    userId: 'user-admin-1', // Using canonical user with exam manager role override
    email: 'exam.manager@royalwellness.lk',
    role: 'exam_department_manager',
    fullName: 'Exam Department Manager'
  });

  before(async () => {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        serverUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  async function seedStudent(email, password, status = 'ACTIVE', registeredDevices = []) {
    const studentId = orderKey(email);
    const passwordHash = await access.hashPassword(password);
    await store.transaction(async tx => {
      await tx.put('student', studentId, {
        id: studentId,
        name: 'Adversarial Test Student',
        email,
        status,
        generation: 1,
        passwordHash,
        registeredDevices
      });
    });
    return studentId;
  }

  // =========================================================================
  // ATTACK VECTOR 1: Attempt to register/login 3rd device without admin approval
  // Expected: HTTP 403 THIRD_DEVICE_BLOCKED
  // =========================================================================
  describe('Attack 1: Attempt to register/login 3rd device without admin approval', () => {
    test('1.1: Live HTTP POST to /api/student/login from 3rd device rejected with HTTP 403 THIRD_DEVICE_BLOCKED', async () => {
      const email = 'attack1-login@example.com';
      const password = 'StrongPassword123!';
      await seedStudent(email, password, 'ACTIVE', [
        { deviceId: 'phone-1', deviceType: 'mobile', status: 'ACTIVE' },
        { deviceId: 'desktop-1', deviceType: 'desktop', status: 'ACTIVE' }
      ]);

      const res = await fetch(`${serverUrl}/api/student/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          deviceId: 'tablet-3',
          deviceType: 'desktop'
        })
      });

      const body = await res.json();
      assert.equal(res.status, 403, 'Must return HTTP 403');
      assert.equal(body.code, 'THIRD_DEVICE_BLOCKED');
      assert.match(body.error, /Maximum 2 devices registered/i);
    });

    test('1.2: Direct call StudentAccess.login() from 3rd device rejected with HTTP 403 THIRD_DEVICE_BLOCKED', async () => {
      const email = 'attack1-direct@example.com';
      const password = 'StrongPassword123!';
      await seedStudent(email, password, 'ACTIVE', [
        { deviceId: 'phone-1', deviceType: 'mobile', status: 'ACTIVE' },
        { deviceId: 'desktop-1', deviceType: 'desktop', status: 'ACTIVE' }
      ]);

      await fails(
        access.login(email, password, makeBrowser('unregistered-3'), 'unknown', {
          deviceId: 'unregistered-3',
          deviceType: 'mobile'
        }),
        'THIRD_DEVICE_BLOCKED'
      );
    });

    test('1.3: Direct call DevicePolicyManager.registerDevice() for 3rd device rejected with HTTP 403 THIRD_DEVICE_BLOCKED', async () => {
      const email = 'attack1-policy@example.com';
      const password = 'StrongPassword123!';
      const studentId = await seedStudent(email, password, 'ACTIVE', [
        { deviceId: 'phone-1', deviceType: 'mobile', status: 'ACTIVE' },
        { deviceId: 'desktop-1', deviceType: 'desktop', status: 'ACTIVE' }
      ]);

      await fails(
        manager.registerDevice(studentId, {
          deviceId: 'device-3',
          deviceType: 'mobile'
        }),
        'THIRD_DEVICE_BLOCKED'
      );
    });

    test('1.4: Authenticated HTTP POST to /api/student/devices/register for 3rd device returns HTTP 403 THIRD_DEVICE_BLOCKED', async () => {
      const email = 'attack1-register-api@example.com';
      const password = 'StrongPassword123!';
      const browser = makeBrowser('desktop-1');
      const studentId = await seedStudent(email, password, 'ACTIVE', [
        { deviceId: 'phone-1', deviceType: 'mobile', status: 'ACTIVE', browserDigest: access.digest(makeBrowser('phone-1')) },
        { deviceId: 'desktop-1', deviceType: 'desktop', status: 'ACTIVE', browserDigest: access.digest(browser) }
      ]);

      // Seed active session on device 1
      let token;
      await store.transaction(async tx => {
        const student = await tx.get('student', studentId);
        student.browserDigest = access.digest(browser);
        const session = await access.newSession(tx, student, browser);
        token = session.token;
      });

      const res = await fetch(`${serverUrl}/api/student/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cookie': `exam_browser=${browser}`
        },
        body: JSON.stringify({
          deviceId: 'device-extra-3',
          deviceType: 'mobile'
        })
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.equal(body.code, 'THIRD_DEVICE_BLOCKED');
    });

    test('1.5: Concurrent race condition: 10 parallel registration attempts when 1 slot remains strictly limits total devices to 2', async () => {
      const email = 'attack1-race@example.com';
      const password = 'StrongPassword123!';
      const studentId = await seedStudent(email, password, 'ACTIVE', [
        { deviceId: 'desktop-1', deviceType: 'desktop', status: 'ACTIVE' }
      ]);

      // 10 concurrent attempts to register different mobile phones
      const attempts = Array.from({ length: 10 }, (_, i) =>
        manager.registerDevice(studentId, {
          deviceId: `phone-race-${i}`,
          deviceType: 'mobile',
          userAgent: `Mozilla/5.0 (iPhone ${i})`
        }).then(
          res => ({ success: true, res }),
          err => ({ success: false, code: err.code })
        )
      );

      const outcomes = await Promise.all(attempts);
      const successes = outcomes.filter(o => o.success);
      const failures = outcomes.filter(o => !o.success);

      assert.equal(successes.length, 1, 'Exactly ONE concurrent registration can claim the mobile slot');
      assert.equal(failures.length, 9, 'All other 9 attempts must be rejected');
      failures.forEach(f => {
        assert.ok(['DEVICE_LIMIT_EXCEEDED', 'THIRD_DEVICE_BLOCKED'].includes(f.code));
      });

      // Confirm registry strictly has 2 devices (1 desktop + 1 mobile)
      const registered = await manager.getRegisteredDevices(studentId);
      assert.equal(registered.length, 2);
      assert.equal(registered.filter(d => d.deviceType === 'desktop').length, 1);
      assert.equal(registered.filter(d => d.deviceType === 'mobile').length, 1);
    });
  });

  // =========================================================================
  // ATTACK VECTOR 2: Attempt to register two mobile phones or two desktop computers
  // Expected: HTTP 403 DEVICE_LIMIT_EXCEEDED
  // =========================================================================
  describe('Attack 2: Attempt to register two mobile phones or two desktop computers', () => {
    test('2.1: Live HTTP POST to /api/student/login with 2nd mobile phone rejected with HTTP 403 DEVICE_LIMIT_EXCEEDED', async () => {
      const email = 'attack2-mobile@example.com';
      const password = 'StrongPassword123!';
      await seedStudent(email, password, 'ACTIVE', [
        { deviceId: 'primary-iphone', deviceType: 'mobile', status: 'ACTIVE', browserDigest: access.digest(makeBrowser('iphone')) }
      ]);

      const res = await fetch(`${serverUrl}/api/student/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
        },
        body: JSON.stringify({
          email,
          password,
          deviceId: 'secondary-samsung-galaxy',
          deviceType: 'mobile'
        })
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.equal(body.code, 'DEVICE_LIMIT_EXCEEDED');
      assert.match(body.error, /mobile device is already registered/i);
    });

    test('2.2: Live HTTP POST to /api/student/login with 2nd desktop computer rejected with HTTP 403 DEVICE_LIMIT_EXCEEDED', async () => {
      const email = 'attack2-desktop@example.com';
      const password = 'StrongPassword123!';
      await seedStudent(email, password, 'ACTIVE', [
        { deviceId: 'primary-thinkpad', deviceType: 'desktop', status: 'ACTIVE', browserDigest: access.digest(makeBrowser('thinkpad')) }
      ]);

      const res = await fetch(`${serverUrl}/api/student/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({
          email,
          password,
          deviceId: 'secondary-macbook-pro',
          deviceType: 'desktop'
        })
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.equal(body.code, 'DEVICE_LIMIT_EXCEEDED');
      assert.match(body.error, /desktop\/laptop is already registered/i);
    });

    test('2.3: Authenticated HTTP POST to /api/student/devices/register with 2nd mobile rejected with HTTP 403 DEVICE_LIMIT_EXCEEDED', async () => {
      const email = 'attack2-auth-mobile@example.com';
      const password = 'StrongPassword123!';
      const browser = makeBrowser('p1');
      const studentId = await seedStudent(email, password, 'ACTIVE', [
        { deviceId: 'phone-1', deviceType: 'mobile', status: 'ACTIVE', browserDigest: access.digest(browser) }
      ]);

      let token;
      await store.transaction(async tx => {
        const student = await tx.get('student', studentId);
        student.browserDigest = access.digest(browser);
        const session = await access.newSession(tx, student, browser);
        token = session.token;
      });

      const res = await fetch(`${serverUrl}/api/student/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cookie': `exam_browser=${browser}`
        },
        body: JSON.stringify({
          deviceId: 'phone-2',
          deviceType: 'mobile'
        })
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.equal(body.code, 'DEVICE_LIMIT_EXCEEDED');
    });

    test('2.4: Authenticated HTTP POST to /api/student/devices/register with 2nd desktop rejected with HTTP 403 DEVICE_LIMIT_EXCEEDED', async () => {
      const email = 'attack2-auth-desktop@example.com';
      const password = 'StrongPassword123!';
      const browser = makeBrowser('pc1');
      const studentId = await seedStudent(email, password, 'ACTIVE', [
        { deviceId: 'pc-1', deviceType: 'desktop', status: 'ACTIVE', browserDigest: access.digest(browser) }
      ]);

      let token;
      await store.transaction(async tx => {
        const student = await tx.get('student', studentId);
        student.browserDigest = access.digest(browser);
        const session = await access.newSession(tx, student, browser);
        token = session.token;
      });

      const res = await fetch(`${serverUrl}/api/student/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cookie': `exam_browser=${browser}`
        },
        body: JSON.stringify({
          deviceId: 'pc-2',
          deviceType: 'desktop'
        })
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.equal(body.code, 'DEVICE_LIMIT_EXCEEDED');
    });

    test('2.5: Attempting to register invalid device type (e.g. tablet, smartwatch, empty) returns HTTP 400 INVALID_DEVICE_TYPE', async () => {
      const email = 'attack2-invalid-type@example.com';
      const password = 'StrongPassword123!';
      const browser = makeBrowser('init');
      const studentId = await seedStudent(email, password, 'ACTIVE', []);

      let token;
      await store.transaction(async tx => {
        const student = await tx.get('student', studentId);
        student.browserDigest = access.digest(browser);
        const session = await access.newSession(tx, student, browser);
        token = session.token;
      });

      for (const badType of ['tablet', 'smartwatch', '', 'server']) {
        const res = await fetch(`${serverUrl}/api/student/devices/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Cookie': `exam_browser=${browser}`
          },
          body: JSON.stringify({
            deviceId: `device-${badType || 'empty'}`,
            deviceType: badType
          })
        });
        const body = await res.json();
        assert.equal(res.status, 400);
        assert.ok(['INVALID_DEVICE_TYPE', 'DEVICE_DETAILS_REQUIRED'].includes(body.code));
      }
    });
  });

  // =========================================================================
  // ATTACK VECTOR 3: Attempt to re-register a revoked device
  // Expected: HTTP 403 THIRD_DEVICE_BLOCKED
  // =========================================================================
  describe('Attack 3: Attempt to re-register a revoked device', () => {
    test('3.1: Live HTTP POST to /api/student/login using revoked deviceId rejected with HTTP 403 THIRD_DEVICE_BLOCKED', async () => {
      const email = 'attack3-login-revoked@example.com';
      const password = 'StrongPassword123!';
      await seedStudent(email, password, 'ACTIVE', [
        {
          deviceId: 'revoked-phone-xyz',
          deviceType: 'mobile',
          status: 'REVOKED',
          browserDigest: access.digest(makeBrowser('revoked')),
          revokedAt: new Date().toISOString()
        },
        {
          deviceId: 'active-replacement-phone',
          deviceType: 'mobile',
          status: 'ACTIVE',
          browserDigest: access.digest(makeBrowser('active-phone'))
        }
      ]);

      const res = await fetch(`${serverUrl}/api/student/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          deviceId: 'revoked-phone-xyz',
          deviceType: 'mobile'
        })
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.equal(body.code, 'THIRD_DEVICE_BLOCKED');
      assert.match(body.error, /previously revoked/i);
    });

    test('3.2: Live HTTP POST to /api/student/login using revoked browser fingerprint rejected with HTTP 403 THIRD_DEVICE_BLOCKED', async () => {
      const email = 'attack3-fingerprint@example.com';
      const password = 'StrongPassword123!';
      const revokedBrowser = makeBrowser('revoked-fp');
      await seedStudent(email, password, 'ACTIVE', [
        {
          deviceId: 'device-old',
          deviceType: 'mobile',
          status: 'REVOKED',
          browserDigest: access.digest(revokedBrowser),
          revokedAt: new Date().toISOString()
        }
      ]);

      const res = await fetch(`${serverUrl}/api/student/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `exam_browser=${revokedBrowser}`
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.equal(body.code, 'THIRD_DEVICE_BLOCKED');
      assert.match(body.error, /previously revoked/i);
    });

    test('3.3: Authenticated HTTP POST to /api/student/devices/register attempting to re-register revoked device ID returns HTTP 403 THIRD_DEVICE_BLOCKED', async () => {
      const email = 'attack3-auth-register@example.com';
      const password = 'StrongPassword123!';
      const browser = makeBrowser('phone');
      const studentId = await seedStudent(email, password, 'ACTIVE', [
        {
          deviceId: 'revoked-laptop-abc',
          deviceType: 'desktop',
          status: 'REVOKED',
          revokedAt: new Date().toISOString()
        },
        {
          deviceId: 'active-phone',
          deviceType: 'mobile',
          status: 'ACTIVE',
          browserDigest: access.digest(browser)
        }
      ]);

      let token;
      await store.transaction(async tx => {
        const student = await tx.get('student', studentId);
        student.browserDigest = access.digest(browser);
        const session = await access.newSession(tx, student, browser);
        token = session.token;
      });

      // Even though desktop slot is currently empty (1 mobile + 0 desktop active), re-registering the revoked device ID must be BLOCKED!
      const res = await fetch(`${serverUrl}/api/student/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cookie': `exam_browser=${browser}`
        },
        body: JSON.stringify({
          deviceId: 'revoked-laptop-abc',
          deviceType: 'desktop'
        })
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.equal(body.code, 'THIRD_DEVICE_BLOCKED');
      assert.match(body.error, /previously revoked/i);
    });

    test('3.4: Direct call DevicePolicyManager.registerDevice() on revoked device rejected with HTTP 403 THIRD_DEVICE_BLOCKED', async () => {
      const email = 'attack3-direct-policy@example.com';
      const password = 'StrongPassword123!';
      const studentId = await seedStudent(email, password, 'ACTIVE', [
        { deviceId: 'dev-revoked-tablet', deviceType: 'mobile', status: 'REVOKED' }
      ]);

      await fails(
        manager.registerDevice(studentId, {
          deviceId: 'dev-revoked-tablet',
          deviceType: 'mobile'
        }),
        'THIRD_DEVICE_BLOCKED'
      );
    });
  });

  // =========================================================================
  // ATTACK VECTOR 4: Attempt to bypass session invalidation after status change
  // Expected: HTTP 401 SESSION_EXPIRED
  // =========================================================================
  describe('Attack 4: Attempt to bypass session invalidation after status change (Suspended/Locked/Disabled)', () => {
    test('4.1: Status changed to Suspended immediately invalidates active session (HTTP 401 SESSION_EXPIRED) on /api/student/me', async () => {
      const email = 'attack4-suspended@example.com';
      const password = 'StrongPassword123!';
      const browser = makeBrowser('suspension-test');
      const studentId = await seedStudent(email, password, 'ACTIVE', [
        { deviceId: 'dev-1', deviceType: 'desktop', status: 'ACTIVE', browserDigest: access.digest(browser) }
      ]);

      // Student logs in
      let token;
      await store.transaction(async tx => {
        const student = await tx.get('student', studentId);
        student.browserDigest = access.digest(browser);
        const session = await access.newSession(tx, student, browser);
        token = session.token;
      });

      // Confirm /api/student/me is 200 OK while active
      const resBefore = await fetch(`${serverUrl}/api/student/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `exam_browser=${browser}`
        }
      });
      assert.equal(resBefore.status, 200);

      // Exam department manager suspends the student via /api/exam-ops/students/:id/status
      const patchRes = await fetch(`${serverUrl}/api/exam-ops/students/${studentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          status: 'Suspended',
          reason: 'Academic violation investigation'
        })
      });
      assert.equal(patchRes.status, 200);

      // Immediate attempt by student to access /api/student/me with the same token MUST return HTTP 401 SESSION_EXPIRED
      const resAfter = await fetch(`${serverUrl}/api/student/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `exam_browser=${browser}`
        }
      });
      const bodyAfter = await resAfter.json();
      assert.equal(resAfter.status, 401);
      assert.equal(bodyAfter.code, 'SESSION_EXPIRED');

      // Attempt to access /api/student/devices MUST also return HTTP 401 SESSION_EXPIRED
      const resDevices = await fetch(`${serverUrl}/api/student/devices`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `exam_browser=${browser}`
        }
      });
      assert.equal(resDevices.status, 401);
      assert.equal((await resDevices.json()).code, 'SESSION_EXPIRED');

      // Attempt to sign in again while Suspended MUST return HTTP 401 INVALID_LOGIN
      const loginAttempt = await fetch(`${serverUrl}/api/student/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      assert.equal(loginAttempt.status, 401);
      assert.equal((await loginAttempt.json()).code, 'INVALID_LOGIN');
    });

    test('4.2: Status changed to Locked via /api/student/admin/:id/status invalidates session and prevents login', async () => {
      const email = 'attack4-locked@example.com';
      const password = 'StrongPassword123!';
      const browser = makeBrowser('lock-test');
      const studentId = await seedStudent(email, password, 'ACTIVE', [
        { deviceId: 'dev-lock', deviceType: 'desktop', status: 'ACTIVE', browserDigest: access.digest(browser) }
      ]);

      let token;
      await store.transaction(async tx => {
        const student = await tx.get('student', studentId);
        student.browserDigest = access.digest(browser);
        const session = await access.newSession(tx, student, browser);
        token = session.token;
      });

      // Admin locks student
      const patchRes = await fetch(`${serverUrl}/api/student/admin/${studentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${examManagerToken}`
        },
        body: JSON.stringify({
          status: 'Locked',
          reason: 'Excessive password failures'
        })
      });
      assert.equal(patchRes.status, 200);

      // Session must be invalid
      const resAfter = await fetch(`${serverUrl}/api/student/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `exam_browser=${browser}`
        }
      });
      assert.equal(resAfter.status, 401);
      assert.equal((await resAfter.json()).code, 'SESSION_EXPIRED');

      // Re-login must be blocked
      const loginAttempt = await fetch(`${serverUrl}/api/student/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      assert.equal(loginAttempt.status, 401);
      assert.equal((await loginAttempt.json()).code, 'INVALID_LOGIN');
    });

    test('4.3: Status changed to Disabled invalidates session and prevents login', async () => {
      const email = 'attack4-disabled@example.com';
      const password = 'StrongPassword123!';
      const browser = makeBrowser('disabled-test');
      const studentId = await seedStudent(email, password, 'ACTIVE', [
        { deviceId: 'dev-dis', deviceType: 'desktop', status: 'ACTIVE', browserDigest: access.digest(browser) }
      ]);

      let token;
      await store.transaction(async tx => {
        const student = await tx.get('student', studentId);
        student.browserDigest = access.digest(browser);
        const session = await access.newSession(tx, student, browser);
        token = session.token;
      });

      // Admin sets status to Disabled
      const patchRes = await fetch(`${serverUrl}/api/student/admin/${studentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          status: 'Disabled',
          reason: 'Account closed'
        })
      });
      assert.equal(patchRes.status, 200);

      // Session must be invalid
      const resAfter = await fetch(`${serverUrl}/api/student/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': `exam_browser=${browser}`
        }
      });
      assert.equal(resAfter.status, 401);
      assert.equal((await resAfter.json()).code, 'SESSION_EXPIRED');
    });
  });

  // =========================================================================
  // ATTACK VECTOR 5: Verify live HTTP requests to /api/student/login succeed without staff credentials
  // =========================================================================
  describe('Attack 5: Verify live HTTP requests to /api/student/login succeed without staff credentials', () => {
    test('5.1: Live HTTP POST to /api/student/login without any Authorization header executes student auth pipeline', async () => {
      const email = 'live-login-nostaff@example.com';
      const password = 'StrongPassword123!';
      await seedStudent(email, password, 'ACTIVE', []);

      const res = await fetch(`${serverUrl}/api/student/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      assert.equal(res.status, 200, 'Student login should succeed with 200 OK');
      const body = await res.json();
      assert.equal(body.success, true);
      // As new device, it issues OTP challenge
      assert.equal(body.data.requiresOtp, true);
      assert.ok(body.data.challengeId);
    });

    test('5.2: Live HTTP POST to /api/student/login with arbitrary/invalid Bearer token does NOT trigger staff 401 gate', async () => {
      const email = 'live-login-with-bad-token@example.com';
      const password = 'StrongPassword123!';
      await seedStudent(email, password, 'ACTIVE', []);

      const res = await fetch(`${serverUrl}/api/student/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer arbitrary-random-invalid-jwt-token'
        },
        body: JSON.stringify({ email, password })
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.requiresOtp, true);
    });

    test('5.3: Live HTTP GET to /api/student/device-info returns 200 OK without any auth headers', async () => {
      const res = await fetch(`${serverUrl}/api/student/device-info`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
        }
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.detectedType, 'mobile');
    });

    test('5.4: Live HTTP non-student protected routes (e.g. /api/exam-ops/dashboard) STRICTLY enforce staff auth wall', async () => {
      const res = await fetch(`${serverUrl}/api/exam-ops/dashboard`, {
        method: 'GET',
        headers: {}
      });

      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'UNAUTHORIZED');
      assert.match(body.error.message, /Authorization Bearer token required/i);
    });

    test('5.5: Full End-to-End Live HTTP Workflow: Login -> OTP Verify -> Device Registered -> Session Verified without staff tokens', async () => {
      const email = 'e2e-live-workflow@example.com';
      const password = 'StrongPassword123!';
      const studentId = await seedStudent(email, password, 'ACTIVE', []);
      const browser = makeBrowser('e2e-live');

      // 1. Live login request
      const loginRes = await fetch(`${serverUrl}/api/student/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `exam_browser=${browser}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
        },
        body: JSON.stringify({
          email,
          password,
          deviceId: 'dev-desktop-live-e2e',
          deviceType: 'desktop'
        })
      });

      assert.equal(loginRes.status, 200);
      const loginBody = await loginRes.json();
      assert.ok(loginBody.data.challengeId);

      // Find code from outbox queue
      const outbox = await store.transaction(tx => tx.list('outbox'));
      const mail = outbox.find(m => m.purpose === 'device-code' && m.to === email);
      assert.ok(mail, 'Device OTP email must be queued in outbox');
      const code = unsealPayload(access, mail.payload).code;
      assert.ok(code, 'OTP code must be extracted');

      // 2. Live OTP verification
      const verifyRes = await fetch(`${serverUrl}/api/student/verify-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `exam_browser=${browser}`
        },
        body: JSON.stringify({
          challengeId: loginBody.data.challengeId,
          code,
          deviceId: 'dev-desktop-live-e2e',
          deviceType: 'desktop'
        })
      });

      assert.equal(verifyRes.status, 200);
      const verifyBody = await verifyRes.json();
      assert.ok(verifyBody.data.token, 'Must return session token');
      const studentToken = verifyBody.data.token;

      // 3. Live call to /api/student/me with student session token
      const meRes = await fetch(`${serverUrl}/api/student/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${studentToken}`,
          'Cookie': `exam_browser=${browser}`
        }
      });

      assert.equal(meRes.status, 200);
      const meBody = await meRes.json();
      assert.equal(meBody.data.student.email, email);
      assert.equal(meBody.data.student.registeredDevices.length, 1);
      assert.equal(meBody.data.student.registeredDevices[0].deviceId, 'dev-desktop-live-e2e');
      assert.equal(meBody.data.student.registeredDevices[0].deviceType, 'desktop');
      assert.equal(meBody.data.student.registeredDevices[0].status, 'ACTIVE');

      // 4. Live call to /api/student/devices
      const devRes = await fetch(`${serverUrl}/api/student/devices`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${studentToken}`,
          'Cookie': `exam_browser=${browser}`
        }
      });
      assert.equal(devRes.status, 200);
      const devBody = await devRes.json();
      assert.equal(devBody.data.devices.length, 1);
    });
  });

});
