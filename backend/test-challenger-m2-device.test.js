import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { StudentAccess, DevicePolicyManager } from './src/studentAccess.js';
import { orderKey } from './src/examOperations.js';

const JWT_SECRET = 'challenger-m2-adversarial-test-secret-2026';

/**
 * Transactional Test Double for isolated, race-safe, in-memory execution.
 */
class TestStore {
  rows = new Map();
  queue = Promise.resolve();
  events = [];

  async transaction(work) {
    const run = this.queue.then(async () => {
      const rows = structuredClone(this.rows);
      const events = structuredClone(this.events);
      const tx = {
        lock: async () => {},
        get: async (kind, id) => structuredClone(rows.get(kind + ':' + id) || null),
        list: async (kind, owner) =>
          [...rows.entries()]
            .filter(([key, value]) => key.startsWith(kind + ':') && (!owner || value.ownerId === owner || value.studentId === owner))
            .map(([, value]) => structuredClone(value)),
        put: async (kind, id, data) => {
          const key = kind + ':' + id;
          const result = {
            ...structuredClone(data),
            revision: (rows.get(key)?.revision || 0) + 1
          };
          rows.set(key, result);
          return result;
        },
        delete: async (kind, id) => {
          rows.delete(kind + ':' + id);
        },
        audit: async (actorId, action, target, details = {}) => {
          const auditEvent = {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            actorId,
            action,
            target,
            details: structuredClone(details)
          };
          events.push(auditEvent);
          rows.set('audit:' + auditEvent.id, auditEvent);
          return auditEvent;
        }
      };
      const value = await work(tx);
      this.rows = rows;
      this.events = events;
      return value;
    });
    this.queue = run.catch(() => {});
    return run;
  }
}

// User personas
const superAdmin = { id: 'admin-root', fullName: 'Super Admin', role: 'super_admin' };
const examManager = { id: 'manager-exam', fullName: 'Exam Department Manager', role: 'exam_department_manager' };
const salesOfficer = { id: 'sales-rep', fullName: 'Sales Officer', role: 'sales_coordinator' };
const financeOfficer = { id: 'fin-rep', fullName: 'Finance Officer', role: 'finance_officer' };

/**
 * Asserts that a promise rejects with expected error code and HTTP status.
 */
async function assertFails(promise, expectedCode, expectedStatus = null) {
  await assert.rejects(promise, error => {
    assert.equal(
      error.code,
      expectedCode,
      `Expected error code '${expectedCode}', got '${error.code}' (${error.message})`
    );
    if (expectedStatus !== null) {
      assert.equal(
        error.status,
        expectedStatus,
        `Expected HTTP status ${expectedStatus}, got ${error.status} (${error.message})`
      );
    }
    return true;
  });
}

/**
 * Decrypts encrypted payload from the simulated outbox.
 */
function unsealPayload(access, payload) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', access.key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final()
    ]).toString()
  );
}

/**
 * Helper factory creating fresh isolated student test environments.
 */
async function createTestHarness(emailPrefix = 'student', initialBrowser = 'browser-device-1') {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);
  const manager = access.devicePolicy;

  const email = `${emailPrefix}-${crypto.randomUUID().slice(0, 8)}@ahg-challenge.test`;
  const studentId = orderKey(email);
  const password = 'StrongChallengerPass2026!';
  const passwordHash = await access.hashPassword(password);

  await store.transaction(async tx => {
    await tx.put('student', studentId, {
      id: studentId,
      name: 'Adversarial Challenger Student',
      email,
      status: 'ACTIVE',
      generation: 1,
      passwordHash,
      browserDigest: access.digest(initialBrowser),
      registeredDevices: []
    });

    await tx.put('asset', 'mat-core-syllabus', {
      id: 'mat-core-syllabus',
      title: 'Core Medical Licensing Syllabus',
      version: '2026.1',
      status: 'PUBLISHED'
    });

    await tx.put('entitlement', `ent-${studentId}`, {
      id: `ent-${studentId}`,
      studentId,
      ownerId: studentId,
      materialIds: ['mat-core-syllabus'],
      status: 'ACTIVE',
      startsAt: new Date(Date.now() - 3600000).toISOString(),
      endsAt: new Date(Date.now() + 90 * 86400000).toISOString()
    });
  });

  return { store, access, manager, email, studentId, password, initialBrowser };
}

describe('Milestone 2 Adversarial Verification: Device Limits & Concurrency', () => {

  // ==========================================================================
  // SECTION 1: TWO MOBILE DEVICES POLICY TEST (MAX 1 PHONE)
  // ==========================================================================
  describe('1. Two Mobile Devices Registration Policy', () => {
    test('Registering first mobile phone succeeds (HTTP 200, ACTIVE)', async () => {
      const { manager, studentId } = await createTestHarness('mobile-test');

      const res = await manager.registerDevice(studentId, {
        deviceId: 'dev-iphone-15-pro',
        deviceType: 'mobile',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
        browserName: 'Mobile Safari'
      });

      assert.equal(res.success, true);
      assert.equal(res.device.deviceId, 'dev-iphone-15-pro');
      assert.equal(res.device.deviceType, 'mobile');
      assert.equal(res.device.status, 'ACTIVE');
      assert.equal(res.devices.length, 1);
    });

    test('Student attempts to register 2 mobile phones -> MUST reject HTTP 403 DEVICE_LIMIT_EXCEEDED', async () => {
      const { manager, studentId } = await createTestHarness('mobile-2-test');

      // Register mobile 1 (iPhone)
      await manager.registerDevice(studentId, {
        deviceId: 'dev-iphone-primary',
        deviceType: 'mobile',
        browserName: 'Safari'
      });

      // Attempt to register mobile 2 (Samsung Galaxy)
      await assertFails(
        manager.registerDevice(studentId, {
          deviceId: 'dev-samsung-galaxy-s24',
          deviceType: 'mobile',
          browserName: 'Chrome Mobile'
        }),
        'DEVICE_LIMIT_EXCEEDED',
        403
      );
    });

    test('Registry strictly retains only the 1st mobile phone after rejected 2nd mobile attempt', async () => {
      const { manager, studentId } = await createTestHarness('mobile-audit');

      await manager.registerDevice(studentId, {
        deviceId: 'dev-pixel-8',
        deviceType: 'mobile'
      });

      await assertFails(
        manager.registerDevice(studentId, {
          deviceId: 'dev-oneplus-12',
          deviceType: 'mobile'
        }),
        'DEVICE_LIMIT_EXCEEDED',
        403
      );

      const registered = await manager.getRegisteredDevices(studentId);
      assert.equal(registered.length, 1, 'Device registry must contain exactly 1 device');
      assert.equal(registered[0].deviceId, 'dev-pixel-8');
      assert.equal(registered[0].deviceType, 'mobile');
    });

    test('Re-registering the same mobile device is idempotent and does not trigger DEVICE_LIMIT_EXCEEDED', async () => {
      const { manager, studentId } = await createTestHarness('mobile-idempotent');

      const res1 = await manager.registerDevice(studentId, {
        deviceId: 'dev-iphone-15',
        deviceType: 'mobile',
        browserName: 'Safari 17.0'
      });
      assert.equal(res1.devices.length, 1);

      // Re-register exact same device with updated browser version
      const res2 = await manager.registerDevice(studentId, {
        deviceId: 'dev-iphone-15',
        deviceType: 'mobile',
        browserName: 'Safari 17.4'
      });
      assert.equal(res2.success, true);
      assert.equal(res2.devices.length, 1, 'Must not duplicate device record');
      assert.equal(res2.device.browserName, 'Safari 17.4');
    });
  });

  // ==========================================================================
  // SECTION 2: TWO COMPUTERS POLICY TEST (MAX 1 COMPUTER)
  // ==========================================================================
  describe('2. Two Computers Registration Policy', () => {
    test('Registering first computer (desktop/laptop) succeeds (HTTP 200, ACTIVE)', async () => {
      const { manager, studentId } = await createTestHarness('pc-test');

      const res = await manager.registerDevice(studentId, {
        deviceId: 'dev-lenovo-thinkpad',
        deviceType: 'desktop',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        browserName: 'Chrome'
      });

      assert.equal(res.success, true);
      assert.equal(res.device.deviceId, 'dev-lenovo-thinkpad');
      assert.equal(res.device.deviceType, 'desktop');
      assert.equal(res.device.status, 'ACTIVE');
      assert.equal(res.devices.length, 1);
    });

    test('Student attempts to register 2 laptop/desktop computers -> MUST reject HTTP 403 DEVICE_LIMIT_EXCEEDED', async () => {
      const { manager, studentId } = await createTestHarness('pc-2-test');

      // Register computer 1 (Dell XPS Laptop)
      await manager.registerDevice(studentId, {
        deviceId: 'dev-dell-xps-15',
        deviceType: 'desktop',
        browserName: 'Chrome Windows'
      });

      // Attempt to register computer 2 (MacBook Pro Laptop)
      await assertFails(
        manager.registerDevice(studentId, {
          deviceId: 'dev-macbook-pro-m3',
          deviceType: 'desktop',
          browserName: 'Chrome macOS'
        }),
        'DEVICE_LIMIT_EXCEEDED',
        403
      );
    });

    test('Registry strictly retains only the 1st computer after rejected 2nd computer attempt', async () => {
      const { manager, studentId } = await createTestHarness('pc-audit');

      await manager.registerDevice(studentId, {
        deviceId: 'dev-surface-pro',
        deviceType: 'desktop'
      });

      await assertFails(
        manager.registerDevice(studentId, {
          deviceId: 'dev-imac-retina',
          deviceType: 'desktop'
        }),
        'DEVICE_LIMIT_EXCEEDED',
        403
      );

      const registered = await manager.getRegisteredDevices(studentId);
      assert.equal(registered.length, 1, 'Device registry must contain exactly 1 device');
      assert.equal(registered[0].deviceId, 'dev-surface-pro');
      assert.equal(registered[0].deviceType, 'desktop');
    });

    test('Re-registering the same computer is idempotent and does not trigger DEVICE_LIMIT_EXCEEDED', async () => {
      const { manager, studentId } = await createTestHarness('pc-idempotent');

      const res1 = await manager.registerDevice(studentId, {
        deviceId: 'dev-workstation-01',
        deviceType: 'desktop',
        browserName: 'Edge 120'
      });
      assert.equal(res1.devices.length, 1);

      const res2 = await manager.registerDevice(studentId, {
        deviceId: 'dev-workstation-01',
        deviceType: 'desktop',
        browserName: 'Edge 122'
      });
      assert.equal(res2.success, true);
      assert.equal(res2.devices.length, 1);
      assert.equal(res2.device.browserName, 'Edge 122');
    });
  });

  // ==========================================================================
  // SECTION 3: 3RD DEVICE ATTEMPT BLOCKING (STRICT 2-DEVICE COMBINATION)
  // ==========================================================================
  describe('3. Third Device Attempt Blocking (When 2 Devices Registered)', () => {
    test('Permitted combo: 1 Mobile + 1 Desktop registers successfully', async () => {
      const { manager, studentId } = await createTestHarness('combo-test');

      const resPhone = await manager.registerDevice(studentId, {
        deviceId: 'dev-iphone-14',
        deviceType: 'mobile'
      });
      assert.equal(resPhone.success, true);

      const resPc = await manager.registerDevice(studentId, {
        deviceId: 'dev-thinkpad-t14',
        deviceType: 'desktop'
      });
      assert.equal(resPc.success, true);
      assert.equal(resPc.devices.length, 2);

      const devices = await manager.getRegisteredDevices(studentId);
      assert.equal(devices.length, 2);
      assert.ok(devices.some(d => d.deviceType === 'mobile'));
      assert.ok(devices.some(d => d.deviceType === 'desktop'));
    });

    test('3rd device attempt when 2 devices are registered -> MUST reject HTTP 403 THIRD_DEVICE_BLOCKED', async () => {
      const { manager, studentId } = await createTestHarness('third-device-test');

      // Register full quota: 1 mobile + 1 desktop
      await manager.registerDevice(studentId, { deviceId: 'dev-phone-slot', deviceType: 'mobile' });
      await manager.registerDevice(studentId, { deviceId: 'dev-laptop-slot', deviceType: 'desktop' });

      // Attempt 3rd device as desktop
      await assertFails(
        manager.registerDevice(studentId, {
          deviceId: 'dev-office-pc-3',
          deviceType: 'desktop'
        }),
        'THIRD_DEVICE_BLOCKED',
        403
      );

      // Attempt 3rd device as mobile
      await assertFails(
        manager.registerDevice(studentId, {
          deviceId: 'dev-ipad-cellular-3',
          deviceType: 'mobile'
        }),
        'THIRD_DEVICE_BLOCKED',
        403
      );
    });

    test('Registry active device count strictly remains 2 after multiple 3rd device attempts', async () => {
      const { manager, studentId } = await createTestHarness('third-device-stability');

      await manager.registerDevice(studentId, { deviceId: 'dev-phone-a', deviceType: 'mobile' });
      await manager.registerDevice(studentId, { deviceId: 'dev-laptop-b', deviceType: 'desktop' });

      for (let i = 1; i <= 3; i++) {
        await assertFails(
          manager.registerDevice(studentId, {
            deviceId: `dev-rogue-device-${i}`,
            deviceType: i % 2 === 0 ? 'desktop' : 'mobile'
          }),
          'THIRD_DEVICE_BLOCKED',
          403
        );
      }

      const devices = await manager.getRegisteredDevices(studentId);
      assert.equal(devices.length, 2);
    });

    test('Attempting to register invalid device type rejects with HTTP 400 INVALID_DEVICE_TYPE', async () => {
      const { manager, studentId } = await createTestHarness('invalid-device-type');

      for (const badType of ['tablet', 'smart_tv', 'console', 'watch', '', null]) {
        await assertFails(
          manager.registerDevice(studentId, {
            deviceId: 'dev-bad-type',
            deviceType: badType
          }),
          'INVALID_DEVICE_TYPE',
          400
        );
      }
    });

    test('Attempting to register device on nonexistent student rejects with HTTP 404 STUDENT_NOT_FOUND', async () => {
      const { manager } = await createTestHarness('nonexistent-student');

      await assertFails(
        manager.registerDevice('student:nonexistent@example.com', {
          deviceId: 'dev-unknown',
          deviceType: 'mobile'
        }),
        'STUDENT_NOT_FOUND',
        404
      );
    });
  });

  // ==========================================================================
  // SECTION 4: CONCURRENT SESSION TERMINATION (SINGLE ACTIVE SESSION ENFORCEMENT)
  // ==========================================================================
  describe('4. Concurrent Session Termination (Single Active Session Enforcement)', () => {
    test('Student logs in on device 1, then logs in on device 2 -> Device 1 session token MUST immediately fail with HTTP 401 SESSION_EXPIRED', async () => {
      const initialBrowser = 'browser-laptop-1';
      const { store, access, email, password } = await createTestHarness('concurrency-test', initialBrowser);

      // 1. Student logs in on Device 1 (laptop) using initial recognized browser
      const session1 = await access.login(email, password, initialBrowser);
      assert.ok(session1.token, 'Device 1 session token must be returned');

      // Verify Device 1 can browse portal
      const portalDev1Before = await access.portal(session1.token, initialBrowser);
      assert.equal(portalDev1Before.student.email, email);
      assert.equal(portalDev1Before.accesses.length, 1);

      // 2. Student logs in on Device 2 (mobile phone)
      const loginChallenge = await access.login(email, password, 'browser-phone-2');
      assert.equal(loginChallenge.requiresOtp, true, 'New browser login must require OTP');
      assert.ok(loginChallenge.challengeId);

      // Extract OTP from outbox
      const mail = [...store.rows.values()].find(x => x.purpose === 'device-code');
      assert.ok(mail, 'Device switch OTP email must be dispatched');
      const otpCode = unsealPayload(access, mail.payload).code;
      assert.match(otpCode, /^\d{8}$/);

      // Verify OTP on Device 2 -> establishes session on Device 2
      const session2 = await access.verifyDevice(loginChallenge.challengeId, otpCode, 'browser-phone-2');
      assert.ok(session2.token, 'Device 2 session token must be created');

      // Verify Device 2 session is active
      const portalDev2 = await access.portal(session2.token, 'browser-phone-2');
      assert.equal(portalDev2.student.email, email);

      // 3. Device 1 session token MUST immediately fail with HTTP 401 SESSION_EXPIRED
      await assertFails(
        access.portal(session1.token, initialBrowser),
        'SESSION_EXPIRED',
        401
      );

      // 4. Low-level authenticate() on Device 1 session token MUST also fail with HTTP 401 SESSION_EXPIRED
      await store.transaction(async tx => {
        await assertFails(
          access.authenticate(tx, session1.token, initialBrowser),
          'SESSION_EXPIRED',
          401
        );
      });
    });

    test('Concurrent device switches have exactly ONE winner and reject runner-up with HTTP 401 INVALID_CODE', async () => {
      const initialBrowser = 'browser-first';
      const { store, access, email, password } = await createTestHarness('race-condition', initialBrowser);

      await access.login(email, password, initialBrowser);
      const challenge = await access.login(email, password, 'browser-second');
      const mail = [...store.rows.values()].find(x => x.purpose === 'device-code');
      const code = unsealPayload(access, mail.payload).code;

      // Two concurrent submissions of the same OTP challenge
      const [res1, res2] = await Promise.allSettled([
        access.verifyDevice(challenge.challengeId, code, 'browser-second'),
        access.verifyDevice(challenge.challengeId, code, 'browser-second')
      ]);

      const fulfilled = [res1, res2].filter(r => r.status === 'fulfilled');
      const rejected = [res1, res2].filter(r => r.status === 'rejected');

      assert.equal(fulfilled.length, 1, 'Exactly one concurrent verification must succeed');
      assert.equal(rejected.length, 1, 'Runner-up verification must be rejected');
      assert.equal(rejected[0].reason.code, 'INVALID_CODE');
      assert.equal(rejected[0].reason.status, 401);
    });
  });

  // ==========================================================================
  // SECTION 5: TOKEN REPLAY DEFENSE & SESSION REVOCATION RESILIENCE
  // ==========================================================================
  describe('5. Token Replay Defense & Session Revocation Resilience', () => {
    test('Token replay: Replaying the old device 1 token repeatedly MUST fail with HTTP 401 SESSION_EXPIRED', async () => {
      const initialBrowser = 'browser-a';
      const { store, access, email, password } = await createTestHarness('replay-test', initialBrowser);

      const session1 = await access.login(email, password, initialBrowser);
      const challenge = await access.login(email, password, 'browser-b');
      const mail = [...store.rows.values()].find(x => x.purpose === 'device-code');
      const code = unsealPayload(access, mail.payload).code;
      await access.verifyDevice(challenge.challengeId, code, 'browser-b');

      // Replay old Device 1 token 5 consecutive times
      for (let i = 1; i <= 5; i++) {
        await assertFails(
          access.portal(session1.token, initialBrowser),
          'SESSION_EXPIRED',
          401
        );
      }
    });

    test('Cross-browser token replay: Presenting old Device 1 token with Device 2 browser fingerprint fails with HTTP 401 SESSION_EXPIRED', async () => {
      const initialBrowser = 'browser-original';
      const { store, access, email, password } = await createTestHarness('cross-browser-replay', initialBrowser);

      const session1 = await access.login(email, password, initialBrowser);
      const challenge = await access.login(email, password, 'browser-new');
      const mail = [...store.rows.values()].find(x => x.purpose === 'device-code');
      const code = unsealPayload(access, mail.payload).code;
      await access.verifyDevice(challenge.challengeId, code, 'browser-new');

      // Attempt to spoof: present session1.token under 'browser-new'
      await assertFails(
        access.portal(session1.token, 'browser-new'),
        'SESSION_EXPIRED',
        401
      );
    });

    test('Explicit logout immediately invalidates token and blocks replay with HTTP 401 SESSION_EXPIRED', async () => {
      const initialBrowser = 'browser-single';
      const { access, email, password } = await createTestHarness('logout-test', initialBrowser);

      const session = await access.login(email, password, initialBrowser);
      await access.portal(session.token, initialBrowser);

      // Explicit logout
      const logoutRes = await access.logout(session.token, initialBrowser);
      assert.equal(logoutRes.signedOut, true);

      // Replay attempt after logout
      await assertFails(
        access.portal(session.token, initialBrowser),
        'SESSION_EXPIRED',
        401
      );
    });

    test('Administrative account suspension immediately revokes active session with HTTP 401 SESSION_EXPIRED', async () => {
      const initialBrowser = 'browser-active';
      const { access, email, studentId, password } = await createTestHarness('suspension-test', initialBrowser);

      const session = await access.login(email, password, initialBrowser);
      await access.portal(session.token, initialBrowser);

      // Super admin suspends student account
      await access.setStatus(superAdmin, studentId, 'Suspended', 'Policy violation investigation');

      // Active session token must immediately fail
      await assertFails(
        access.portal(session.token, initialBrowser),
        'SESSION_EXPIRED',
        401
      );
    });

    test('Arbitrary forged session token fails with HTTP 401 UNAUTHORIZED', async () => {
      const { access } = await createTestHarness('forgery-test');

      const forgedToken = crypto.randomBytes(32).toString('base64url');
      await assertFails(
        access.portal(forgedToken, 'browser-any'),
        'UNAUTHORIZED',
        401
      );
    });
  });

  // ==========================================================================
  // SECTION 6: 5 INVALID OTP SUBMISSIONS CHALLENGE LOCKOUT
  // ==========================================================================
  describe('6. Five Invalid OTP Code Submissions Challenge Lockout', () => {
    test('Device replacement challenge: 5 invalid OTP code submissions -> challenge MUST lock (HTTP 400 CHALLENGE_LOCKED)', async () => {
      const { manager, studentId } = await createTestHarness('otp-lockout-test');

      // Register initial devices
      await manager.registerDevice(studentId, { deviceId: 'phone-1', deviceType: 'mobile' });
      await manager.registerDevice(studentId, { deviceId: 'laptop-1', deviceType: 'desktop' });

      // Initiate replacement challenge for 3rd device
      const challengeReq = await manager.requestDeviceReplacement(studentId, {
        targetDeviceId: 'phone-new',
        targetDeviceType: 'mobile'
      });
      assert.ok(challengeReq.challengeId);
      assert.ok(challengeReq.codeForTest, '8-digit OTP generated');

      // 4 consecutive invalid OTP submissions -> must fail with HTTP 400 INVALID_OTP
      for (let i = 1; i <= 4; i++) {
        await assertFails(
          manager.verifyReplacementOtp(challengeReq.challengeId, '00000000'),
          'INVALID_OTP',
          400
        );
      }

      // 5th invalid OTP submission -> MUST LOCK the challenge with HTTP 400 CHALLENGE_LOCKED
      await assertFails(
        manager.verifyReplacementOtp(challengeReq.challengeId, '00000000'),
        'CHALLENGE_LOCKED',
        400
      );

      // Subsequent attempt with the CORRECT OTP code MUST STILL FAIL with HTTP 400 CHALLENGE_LOCKED
      await assertFails(
        manager.verifyReplacementOtp(challengeReq.challengeId, challengeReq.codeForTest),
        'CHALLENGE_LOCKED',
        400
      );
    });

    test('Locked replacement challenge cannot be approved by CRM administrator (fails INVALID_CHALLENGE_STATE)', async () => {
      const { manager, studentId } = await createTestHarness('locked-approval-block');

      await manager.registerDevice(studentId, { deviceId: 'phone-1', deviceType: 'mobile' });
      await manager.registerDevice(studentId, { deviceId: 'pc-1', deviceType: 'desktop' });

      const challengeReq = await manager.requestDeviceReplacement(studentId, {
        targetDeviceId: 'phone-2',
        targetDeviceType: 'mobile'
      });

      // Lock challenge with 5 wrong attempts
      for (let i = 0; i < 5; i++) {
        try {
          await manager.verifyReplacementOtp(challengeReq.challengeId, '99999999');
        } catch {}
      }

      // Super Admin attempts to approve locked challenge
      await assertFails(
        manager.approveDeviceReplacement(superAdmin, challengeReq.challengeId),
        'INVALID_CHALLENGE_STATE',
        400
      );
    });

    test('Device switch login challenge: 5 invalid OTP code submissions permanently locks login challenge while preserving existing session', async () => {
      const initialBrowser = 'device-1-browser';
      const { store, access, email, password } = await createTestHarness('device-switch-lockout', initialBrowser);

      // Legitimate session on Device 1
      const session1 = await access.login(email, password, initialBrowser);
      await access.portal(session1.token, initialBrowser);

      // Attacker initiates login on Device 2
      const challenge = await access.login(email, password, 'device-2-attacker');
      const mail = [...store.rows.values()].find(x => x.purpose === 'device-code');
      const correctCode = unsealPayload(access, mail.payload).code;
      const wrongCode = correctCode === '12345678' ? '87654321' : '12345678';

      // 5 consecutive invalid submissions on Device 2
      for (let i = 0; i < 5; i++) {
        await assertFails(
          access.verifyDevice(challenge.challengeId, wrongCode, 'device-2-attacker'),
          'INVALID_CODE',
          401
        );
      }

      // 6th attempt with the CORRECT code MUST STILL FAIL (challenge locked)
      await assertFails(
        access.verifyDevice(challenge.challengeId, correctCode, 'device-2-attacker'),
        'INVALID_CODE',
        401
      );

      // CRITICAL VERIFICATION: Device 1 legitimate session remains COMPLETELY UNAFFECTED and ACTIVE
      const portalDev1 = await access.portal(session1.token, initialBrowser);
      assert.equal(portalDev1.student.email, email, 'Legitimate Device 1 session must not be terminated by attacker lockout');
    });
  });

  // ==========================================================================
  // SECTION 7: END-TO-END REPLACEMENT WORKFLOW & REVOCATION AUDIT
  // ==========================================================================
  describe('7. End-to-End Device Replacement & Revoked Device Session Termination', () => {
    test('End-to-end device replacement: OTP verified -> Super admin approves -> Old device revoked -> Active sessions terminated', async () => {
      const initialBrowser = 'browser-device-1';
      const { store, access, manager, email, studentId, password } = await createTestHarness('e2e-replacement', initialBrowser);

      // 1. Initial registered devices: Mobile 1 (iPhone 13) + Desktop 1 (ThinkPad)
      await manager.registerDevice(studentId, {
        deviceId: 'dev-iphone-13',
        deviceType: 'mobile',
        browserName: 'Mobile Safari'
      });
      await manager.registerDevice(studentId, {
        deviceId: 'dev-thinkpad',
        deviceType: 'desktop',
        browserName: 'Chrome'
      });

      // 2. Student is currently logged in on old Mobile 1
      const oldMobileSession = await access.login(email, password, initialBrowser);
      assert.ok(oldMobileSession.token);

      // 3. Student acquires new Mobile 2 (iPhone 15) and requests replacement
      const replacementReq = await manager.requestDeviceReplacement(studentId, {
        targetDeviceId: 'dev-iphone-15-new',
        targetDeviceType: 'mobile'
      });
      assert.ok(replacementReq.challengeId);

      // 4. Verify OTP on new Mobile 2
      const verifyRes = await manager.verifyReplacementOtp(replacementReq.challengeId, replacementReq.codeForTest);
      assert.equal(verifyRes.status, 'PENDING_ADMIN_APPROVAL');

      // 5. Unauthorized role (Sales Officer) attempting approval must be rejected with HTTP 403 FORBIDDEN
      await assertFails(
        manager.approveDeviceReplacement(salesOfficer, replacementReq.challengeId),
        'FORBIDDEN',
        403
      );

      // 6. Authorized Super Admin approves replacement
      const approvalRes = await manager.approveDeviceReplacement(superAdmin, replacementReq.challengeId);
      assert.equal(approvalRes.success, true);
      assert.equal(approvalRes.revokedDeviceId, 'dev-iphone-13', 'Old mobile must be revoked');
      assert.equal(approvalRes.newDeviceId, 'dev-iphone-15-new', 'New mobile must be activated');

      // 7. Verify registry: exactly 2 devices remain active (new phone + existing laptop)
      const allDevices = await manager.getRegisteredDevices(studentId);
      const activeDevices = allDevices.filter(d => d.status === 'ACTIVE');

      assert.equal(activeDevices.length, 2, 'Active devices must strictly equal 2');
      assert.ok(activeDevices.some(d => d.deviceId === 'dev-iphone-15-new' && d.deviceType === 'mobile'));
      assert.ok(activeDevices.some(d => d.deviceId === 'dev-thinkpad' && d.deviceType === 'desktop'));

      // 8. Session revocation check: The session on the old revoked phone MUST BE TERMINATED with HTTP 401 SESSION_EXPIRED
      // (Because approveDeviceReplacement increments student.generation)
      await assertFails(
        access.portal(oldMobileSession.token, initialBrowser),
        'SESSION_EXPIRED',
        401
      );

      // 9. Verify audit trail: security.device_replacement.approved event recorded
      const approvalAudit = store.events.find(e => e.action === 'security.device_replacement.approved');
      assert.ok(approvalAudit, 'security.device_replacement.approved audit entry must exist');
      assert.equal(approvalAudit.actorId, superAdmin.id);
      assert.equal(approvalAudit.details.revokedDeviceId, 'dev-iphone-13');
      assert.equal(approvalAudit.details.newDeviceId, 'dev-iphone-15-new');
    });
  });

});
