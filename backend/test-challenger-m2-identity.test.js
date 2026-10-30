import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { StudentAccess, DevicePolicyManager } from './src/studentAccess.js';
import { ExamOperations, orderKey } from './src/examOperations.js';
import { ExamError } from './src/examPolicy.js';
import { TestStore, fails, unsealPayload, JWT_SECRET } from './tests/e2e/fixtures/testHarness.js';
import { superAdmin, examManager, salesOfficer, examOfficer, financeOfficer } from './tests/e2e/fixtures/actors.js';
import { createOrderRequirementInput, createSalesHandoffInput } from './tests/e2e/fixtures/payloads.js';

// ============================================================================
// CHALLENGER SUITE 1: Password Policy Enforcement
// ============================================================================

test('CHALLENGER P1: Password Policy — Empty string, non-strings, and null/undefined reject HTTP 400 PASSWORD_POLICY', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);

  const invalidInputs = [
    '',
    null,
    undefined,
    123456789012345,
    {},
    [],
    true
  ];

  for (const input of invalidInputs) {
    let thrownError = null;
    try {
      await access.hashPassword(input);
    } catch (err) {
      thrownError = err;
    }
    assert.ok(thrownError, `Expected password rejection for input: ${JSON.stringify(input)}`);
    assert.equal(thrownError.code, 'PASSWORD_POLICY', `Error code must be PASSWORD_POLICY, got: ${thrownError.code}`);
    assert.equal(thrownError.status, 400, `HTTP status must be 400, got: ${thrownError.status}`);
  }
});

test('CHALLENGER P1: Password Policy — Passwords strictly less than 15 characters reject HTTP 400 PASSWORD_POLICY', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);

  const shortPasswords = [
    'A',
    'Short1!',
    'Pass12345678',       // 12 chars
    'Pass123456789',      // 13 chars
    'Pass1234567890'      // 14 chars
  ];

  for (const pwd of shortPasswords) {
    assert.equal(pwd.length < 15, true);
    let thrownError = null;
    try {
      await access.hashPassword(pwd);
    } catch (err) {
      thrownError = err;
    }
    assert.ok(thrownError, `Password with length ${pwd.length} must be rejected`);
    assert.equal(thrownError.code, 'PASSWORD_POLICY');
    assert.equal(thrownError.status, 400);
  }
});

test('CHALLENGER P1: Password Policy — Passwords exceeding 256 characters reject HTTP 400 PASSWORD_POLICY', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);

  const oversizedPassword = 'A'.repeat(257);
  let thrownError = null;
  try {
    await access.hashPassword(oversizedPassword);
  } catch (err) {
    thrownError = err;
  }
  assert.ok(thrownError, 'Password > 256 characters must be rejected');
  assert.equal(thrownError.code, 'PASSWORD_POLICY');
  assert.equal(thrownError.status, 400);
});

test('CHALLENGER P1: Password Policy — Trivial repeated characters reject HTTP 400 PASSWORD_POLICY', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);

  const repeatedPasswords = [
    'aaaaaaaaaaaaaaa',       // 15 repeated 'a'
    'AAAAAAAAAAAAAAAA',      // 16 repeated 'A'
    '111111111111111',       // 15 repeated '1'
    '9999999999999999',      // 16 repeated '9'
    '!!!!!!!!!!!!!!!',       // 15 repeated '!'
    '................'       // 16 repeated '.'
  ];

  for (const pwd of repeatedPasswords) {
    let thrownError = null;
    try {
      await access.hashPassword(pwd);
    } catch (err) {
      thrownError = err;
    }
    assert.ok(thrownError, `Trivially repeated password "${pwd}" must be rejected`);
    assert.equal(thrownError.code, 'PASSWORD_POLICY');
    assert.equal(thrownError.status, 400);
  }
});

test('CHALLENGER P1: Password Policy — Trivial / common dictionary prefixes reject HTTP 400 PASSWORD_POLICY', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);

  const dictionaryPrefixedPasswords = [
    'password12345678',       // starts with 'password'
    'PASSWORD_Secure_99',     // starts with case-insensitive 'password'
    '123456789abcdefgh',      // starts with '123456789'
    'qwertyuiopasdfgh',       // starts with 'qwerty'
    'QWERTY_expert_2026',     // starts with 'qwerty'
    'letmein1234567890',      // starts with 'letmein'
    'LETMEIN_open_sesame'     // starts with 'letmein'
  ];

  for (const pwd of dictionaryPrefixedPasswords) {
    let thrownError = null;
    try {
      await access.hashPassword(pwd);
    } catch (err) {
      thrownError = err;
    }
    assert.ok(thrownError, `Dictionary-prefixed password "${pwd}" must be rejected`);
    assert.equal(thrownError.code, 'PASSWORD_POLICY');
    assert.equal(thrownError.status, 400);
  }
});

test('CHALLENGER P1: Password Policy — Strong compliant passwords succeed and produce valid scrypt format', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);

  const validPasswords = [
    'CorrectHorseBatteryStaple2026!',
    'AlphaHealth#ExamSecurity!Pass99',
    'Complex-Medical-Passphrase-Valid-2026'
  ];

  for (const pwd of validPasswords) {
    const hash = await access.hashPassword(pwd);
    assert.ok(hash);
    const parts = hash.split(':');
    assert.equal(parts.length, 2, 'Password hash format must be salt:digest');
    assert.equal(parts[0].length, 32, 'Salt must be 16 bytes (32 hex characters)');
    assert.equal(parts[1].length, 128, 'Derived scrypt key must be 64 bytes (128 hex characters)');
    assert.equal(hash.includes(pwd), false, 'Plaintext password must never appear in the hash');
  }
});

// ============================================================================
// CHALLENGER SUITE 2: Timing-Attack Defense & Public Error Symmetry
// ============================================================================

test('CHALLENGER P2: Timing-Attack Defense — Nonexistent account vs wrong password return identical HTTP 401 INVALID_LOGIN error', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);

  const existingEmail = 'fatima.timing.test@alphahealthgroup.ae';
  const studentId = orderKey(existingEmail);
  const correctPassword = 'StrongLegitimatePassword2026!';
  const passwordHash = await access.hashPassword(correctPassword);

  // Setup active student in store
  await store.transaction(tx =>
    tx.put('student', studentId, {
      id: studentId,
      name: 'Dr. Fatima Timing',
      email: existingEmail,
      status: 'ACTIVE',
      generation: 1,
      passwordHash,
      browserDigest: access.digest('browser-known')
    })
  );

  const nonexistentEmail = 'completely.nonexistent.user@alphahealthgroup.ae';
  const wrongPassword = 'SomeIncorrectPasswordCandidate2026!';

  // Attempt A: Nonexistent user
  let errNonexistent = null;
  try {
    await access.login(nonexistentEmail, wrongPassword, 'browser-test');
  } catch (err) {
    errNonexistent = err;
  }

  // Attempt B: Existing user with wrong password
  let errWrongPassword = null;
  try {
    await access.login(existingEmail, wrongPassword, 'browser-test');
  } catch (err) {
    errWrongPassword = err;
  }

  // Verify absolute public symmetry
  assert.ok(errNonexistent, 'Nonexistent account login must reject');
  assert.ok(errWrongPassword, 'Wrong password login must reject');

  assert.equal(errNonexistent.code, 'INVALID_LOGIN', 'Nonexistent user must return INVALID_LOGIN code');
  assert.equal(errWrongPassword.code, 'INVALID_LOGIN', 'Wrong password must return INVALID_LOGIN code');

  assert.equal(errNonexistent.status, 401, 'Nonexistent user must return HTTP 401');
  assert.equal(errWrongPassword.status, 401, 'Wrong password must return HTTP 401');

  assert.equal(errNonexistent.message, 'Unable to sign in with those details.', 'Public message must match exactly');
  assert.equal(errWrongPassword.message, 'Unable to sign in with those details.', 'Public message must match exactly');
});

test('CHALLENGER P2: Timing-Attack Defense — Nonexistent account executes scrypt workload (timing benchmark)', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);

  const existingEmail = 'benchmark.student@alphahealthgroup.ae';
  const studentId = orderKey(existingEmail);
  const correctPassword = 'StrongLegitimatePassword2026!';
  const passwordHash = await access.hashPassword(correctPassword);

  await store.transaction(tx =>
    tx.put('student', studentId, {
      id: studentId,
      name: 'Dr. Benchmark',
      email: existingEmail,
      status: 'ACTIVE',
      generation: 1,
      passwordHash,
      browserDigest: access.digest('browser-bench')
    })
  );

  const iterations = 5;
  const nonexistentDurations = [];
  const wrongPasswordDurations = [];

  // Measure Nonexistent Account Login
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    try {
      await access.login(`ghost.${i}@alphahealthgroup.ae`, 'CandidatePasswordTry2026!', 'browser-bench');
    } catch {}
    nonexistentDurations.push(performance.now() - t0);
  }

  // Measure Existing Account with Wrong Password Login
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    try {
      await access.login(existingEmail, `WrongCandidatePasswordTry${i}2026!`, 'browser-bench');
    } catch {}
    wrongPasswordDurations.push(performance.now() - t0);
  }

  const avgNonexistent = nonexistentDurations.reduce((a, b) => a + b, 0) / iterations;
  const avgWrongPassword = wrongPasswordDurations.reduce((a, b) => a + b, 0) / iterations;

  // Both cases must take non-trivial time (i.e. scrypt workload actually executed, > 5ms)
  assert.ok(
    avgNonexistent >= 5.0,
    `Nonexistent account verification must execute scrypt workload (expected >= 5ms, took ${avgNonexistent.toFixed(2)}ms)`
  );
  assert.ok(
    avgWrongPassword >= 5.0,
    `Wrong password verification must execute scrypt workload (expected >= 5ms, took ${avgWrongPassword.toFixed(2)}ms)`
  );

  // Time difference ratio between nonexistent and wrong password should be within reasonable scrypt parity (within 3x)
  const ratio = avgNonexistent / avgWrongPassword;
  assert.ok(
    ratio >= 0.3 && ratio <= 3.0,
    `Timing ratio between nonexistent (${avgNonexistent.toFixed(2)}ms) and wrong password (${avgWrongPassword.toFixed(2)}ms) must be balanced (got ratio ${ratio.toFixed(2)})`
  );
});

// ============================================================================
// CHALLENGER SUITE 3: Plaintext Credentials & Password Leak Protection
// ============================================================================

test('CHALLENGER P3: Plaintext Credentials — Staff APIs, requirement lists, handoffs, and audit logs NEVER return passwordHash or plaintext passwords', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const access = new StudentAccess(store, JWT_SECRET);

  const studentEmail = 'confidential.student@alphahealthgroup.ae';
  const studentId = orderKey(studentEmail);
  const sensitivePlaintextPassword = 'TopSecretMedicalStudentPass2026!#';
  const passwordHash = await access.hashPassword(sensitivePlaintextPassword);

  // 1. Create student with known browser digest and published asset
  await store.transaction(async tx => {
    await tx.put('asset', 'mat-confidential-core', { id: 'mat-confidential-core', title: 'Confidential Notes', status: 'PUBLISHED' });
    await tx.put('student', studentId, {
      id: studentId,
      name: 'Dr. Confidential',
      email: studentEmail,
      status: 'ACTIVE',
      generation: 1,
      passwordHash,
      browserDigest: access.digest('browser-known'),
      registeredDevices: [
        { deviceId: 'dev-phone-1', deviceType: 'mobile', status: 'ACTIVE' }
      ]
    });
  });

  // 2. Submit order requirement and sales handoff
  const orderInput = createOrderRequirementInput({
    orderId: 'order-confidential-101',
    email: studentEmail,
    studentName: 'Dr. Confidential'
  });
  const req = await ops.submit(salesOfficer, orderInput);
  await ops.update(superAdmin, req.id, 'verify-payment', { revision: 1, reference: 'TXN-CONF-101' });
  await ops.update(examManager, req.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, req.id, 'transition', { revision: 3, status: 'PREPARING' });
  await ops.update(examManager, req.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: true });
  await ops.update(examManager, req.id, 'mark-email-verified', { revision: 5, reason: 'Verified via voice call' });
  await ops.update(examManager, req.id, 'transition', { revision: 6, status: 'READY' });
  await ops.update(examManager, req.id, 'transition', { revision: 7, status: 'PENDING_MANAGER_APPROVAL' });
  await ops.update(examManager, req.id, 'manager-approve', { revision: 8, reason: 'Approved' });
  await ops.update(superAdmin, req.id, 'prepare-access', { revision: 9, materialIds: ['mat-confidential-core'] });

  // Submit sales handoff
  await ops.submitHandoff(salesOfficer, createSalesHandoffInput({
    clientEmail: studentEmail,
    clientName: 'Dr. Confidential'
  }));

  // 3. Inspect staff requirements list for authorized intake roles (superAdmin, examManager, salesOfficer)
  const intakeAuthorizedRoles = [superAdmin, examManager, salesOfficer];
  for (const staff of intakeAuthorizedRoles) {
    const list = await ops.list(staff);
    assert.ok(Array.isArray(list));
    const serialized = JSON.stringify(list);
    assert.equal(serialized.includes(sensitivePlaintextPassword), false, `Staff role ${staff.role} response contains plaintext password`);
    assert.equal(serialized.includes(passwordHash), false, `Staff role ${staff.role} response contains passwordHash`);

    // Recursively check no key is password or passwordHash
    for (const item of list) {
      assert.equal(item.password, undefined);
      assert.equal(item.passwordHash, undefined);
    }
  }

  // Unauthorized roles (examOfficer, financeOfficer) cannot even view the full requirements intake list
  await fails(ops.list(examOfficer), 'FORBIDDEN');
  await fails(ops.list(financeOfficer), 'FORBIDDEN');

  // 4. Inspect staff handoffs list for handoff-authorized roles
  const handoffRoles = [superAdmin, examManager, salesOfficer, examOfficer];
  for (const staff of handoffRoles) {
    const handoffs = await ops.listHandoffs(staff);
    assert.ok(Array.isArray(handoffs));
    const serialized = JSON.stringify(handoffs);
    assert.equal(serialized.includes(sensitivePlaintextPassword), false);
    assert.equal(serialized.includes(passwordHash), false);
  }

  // 5. Inspect DevicePolicyManager device listings
  const manager = new DevicePolicyManager(store, JWT_SECRET);
  const devices = await manager.getRegisteredDevices(studentId);
  const serializedDevices = JSON.stringify(devices);
  assert.equal(serializedDevices.includes(sensitivePlaintextPassword), false);
  assert.equal(serializedDevices.includes(passwordHash), false);

  // 6. Inspect student portal session view
  const session = await access.login(studentEmail, sensitivePlaintextPassword, 'browser-known');
  assert.ok(session.token, 'Session token must be generated');
  const portal = await access.portal(session.token, 'browser-known');
  assert.equal(portal.student.password, undefined, 'Portal student view must not contain password');
  assert.equal(portal.student.passwordHash, undefined, 'Portal student view must not contain passwordHash');

  // 7. Inspect immutable audit log
  const auditLogs = store.events;
  for (const event of auditLogs) {
    const serializedEvent = JSON.stringify(event);
    assert.equal(serializedEvent.includes(sensitivePlaintextPassword), false, `Audit event ${event.action} leaks plaintext password`);
    assert.equal(serializedEvent.includes(passwordHash), false, `Audit event ${event.action} leaks passwordHash`);
  }
});

// ============================================================================
// CHALLENGER SUITE 4: Identity Linking Across Multiple Subsequent Orders
// ============================================================================

test('CHALLENGER P4: Identity Linking — Submitting 3 subsequent orders for same student email results in exactly 1 student record with linked entitlements', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const access = new StudentAccess(store, JWT_SECRET);

  const studentEmail = 'dr.amira.khalid@ahg-hospital.ae';
  const studentId = orderKey(studentEmail);

  // Setup 3 distinct published materials
  await store.transaction(async tx => {
    await tx.put('asset', 'mat-dha-anatomy', { id: 'mat-dha-anatomy', title: 'DHA Clinical Anatomy', status: 'PUBLISHED' });
    await tx.put('asset', 'mat-nclex-pharmacology', { id: 'mat-nclex-pharmacology', title: 'NCLEX Pharmacology Review', status: 'PUBLISHED' });
    await tx.put('asset', 'mat-mohap-pathology', { id: 'mat-mohap-pathology', title: 'MOHAP Pathology & Diagnostics', status: 'PUBLISHED' });
  });

  const orders = [
    {
      orderId: 'order-001-dha',
      packageId: 'PKG-DHA-GP',
      email: studentEmail,
      materialIds: ['mat-dha-anatomy'],
      ref: 'TXN-001'
    },
    {
      orderId: 'order-002-nclex',
      packageId: 'PKG-NCLEX-RN',
      email: studentEmail,
      materialIds: ['mat-nclex-pharmacology'],
      ref: 'TXN-002'
    },
    {
      // Test case variation: uppercase email input to challenge casing normalization
      orderId: 'order-003-mohap',
      packageId: 'PKG-MOHAP-SPEC',
      email: 'DR.AMIRA.KHALID@AHG-HOSPITAL.AE',
      materialIds: ['mat-mohap-pathology'],
      ref: 'TXN-003'
    }
  ];

  // Process all 3 orders completely
  for (const ord of orders) {
    const input = createOrderRequirementInput({
      orderId: ord.orderId,
      packageId: ord.packageId,
      email: ord.email,
      studentName: 'Dr. Amira Khalid',
      services: ['exam_material']
    });

    const req = await ops.submit(salesOfficer, input);
    await ops.update(superAdmin, req.id, 'verify-payment', { revision: 1, reference: ord.ref });
    await ops.update(examManager, req.id, 'transition', { revision: 2, status: 'ACCEPTED' });
    await ops.update(examManager, req.id, 'transition', { revision: 3, status: 'PREPARING' });
    await ops.update(examManager, req.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: true });
    await ops.update(examManager, req.id, 'mark-email-verified', { revision: 5, reason: 'Verified student record' });
    await ops.update(examManager, req.id, 'transition', { revision: 6, status: 'READY' });
    await ops.update(examManager, req.id, 'transition', { revision: 7, status: 'PENDING_MANAGER_APPROVAL' });
    await ops.update(examManager, req.id, 'manager-approve', { revision: 8, reason: 'Approved access package' });
    await ops.update(superAdmin, req.id, 'prepare-access', { revision: 9, materialIds: ord.materialIds });
  }

  // Verification 1: Exactly ONE record exists in student store
  const studentStoreEntries = [...store.rows.entries()].filter(([k]) => k.startsWith('student:'));
  assert.equal(
    studentStoreEntries.length,
    1,
    `Expected exactly 1 student record in store across 3 purchases, found: ${studentStoreEntries.length}`
  );
  assert.equal(studentStoreEntries[0][0], `student:${studentId}`);
  assert.equal(studentStoreEntries[0][1].id, studentId);
  assert.equal(studentStoreEntries[0][1].email.toLowerCase(), studentEmail.toLowerCase());

  // Verification 2: All 3 entitlements are linked to the single student ID
  const studentEntitlements = await store.transaction(tx => tx.list('entitlement', studentId));
  assert.equal(
    studentEntitlements.length,
    3,
    `Expected exactly 3 entitlements linked to student ${studentId}, found: ${studentEntitlements.length}`
  );

  const linkedPackageIds = studentEntitlements.map(e => e.packageId);
  assert.ok(linkedPackageIds.includes('PKG-DHA-GP'), 'PKG-DHA-GP must be linked');
  assert.ok(linkedPackageIds.includes('PKG-NCLEX-RN'), 'PKG-NCLEX-RN must be linked');
  assert.ok(linkedPackageIds.includes('PKG-MOHAP-SPEC'), 'PKG-MOHAP-SPEC must be linked');

  // Verification 3: Activate student account and verify unified portal access
  const password = 'StrongAmiraPassword2026!#';
  const passwordHash = await access.hashPassword(password);
  const nowIso = new Date().toISOString();

  await store.transaction(async tx => {
    const student = await tx.get('student', studentId, true);
    student.status = 'ACTIVE';
    student.activatedAt = nowIso;
    student.emailVerifiedAt = nowIso;
    student.passwordHash = passwordHash;
    student.browserDigest = access.digest('browser-unified');
    await tx.put('student', studentId, student);

    for (const ent of studentEntitlements) {
      ent.startsAt = nowIso;
      ent.endsAt = new Date(Date.now() + 90 * 86400000).toISOString();
      await tx.put('entitlement', ent.id, ent);
    }
  });

  const session = await access.login(studentEmail, password, 'browser-unified');
  const portal = await access.portal(session.token, 'browser-unified');

  assert.equal(portal.student.id, studentId);
  assert.equal(portal.accesses.length, 3, 'Portal accesses must contain all 3 packages');
  const accessibleAssetIds = portal.assets.map(a => a.id);
  assert.ok(accessibleAssetIds.includes('mat-dha-anatomy'), 'DHA Anatomy must be accessible');
  assert.ok(accessibleAssetIds.includes('mat-nclex-pharmacology'), 'NCLEX Pharmacology must be accessible');
  assert.ok(accessibleAssetIds.includes('mat-mohap-pathology'), 'MOHAP Pathology must be accessible');
});

// ============================================================================
// CHALLENGER SUITE 5: Admin Approval of Device Replacement & Session Termination
// ============================================================================

test('CHALLENGER P5: Admin Device Replacement — Old device of same category is revoked, and all active sessions on that revoked device are terminated immediately', async () => {
  const store = new TestStore();
  const manager = new DevicePolicyManager(store, JWT_SECRET);
  const access = manager.studentAccess;

  const email = 'device.replacement.student@alphahealthgroup.ae';
  const studentId = orderKey(email);
  const password = 'SecureDevicePassphrase2026!';
  const passwordHash = await access.hashPassword(password);
  const nowIso = new Date().toISOString();

  // 1. Setup active student with 2 initial devices: 1 Mobile (iPhone 13) and 1 Desktop (ThinkPad X1)
  await store.transaction(async tx => {
    await tx.put('student', studentId, {
      id: studentId,
      name: 'Dr. Device Test',
      email,
      status: 'ACTIVE',
      generation: 1,
      passwordHash,
      browserDigest: access.digest('browser-iphone13'),
      registeredDevices: []
    });
    await tx.put('asset', 'mat-sample-guide', { id: 'mat-sample-guide', title: 'Sample Guide', status: 'PUBLISHED' });
    await tx.put('entitlement', 'ent-sample-1', {
      id: 'ent-sample-1',
      studentId,
      ownerId: studentId,
      materialIds: ['mat-sample-guide'],
      status: 'ACTIVE',
      startsAt: nowIso,
      endsAt: new Date(Date.now() + 60 * 86400000).toISOString()
    });
  });

  // Register Phone 1 (Mobile)
  await manager.registerDevice(studentId, {
    deviceId: 'phone-iphone-13',
    deviceType: 'mobile',
    browserName: 'Mobile Safari iOS 16'
  });

  // Register Laptop 1 (Desktop)
  await manager.registerDevice(studentId, {
    deviceId: 'laptop-thinkpad-x1',
    deviceType: 'desktop',
    browserName: 'Chrome Windows 11'
  });

  // 2. Active session established on Phone 1
  const sessionPhone = await access.login(email, password, 'browser-iphone13');
  assert.ok(sessionPhone.token, 'Phone session token established');

  // Verify Phone 1 session is active and functional
  const portalPhoneBefore = await access.portal(sessionPhone.token, 'browser-iphone13');
  assert.equal(portalPhoneBefore.accesses.length, 1);

  // 3. Attempt to register a 3rd device (iPhone 16 Pro) directly -> blocked
  await fails(
    manager.registerDevice(studentId, {
      deviceId: 'phone-iphone-16-pro',
      deviceType: 'mobile'
    }),
    'THIRD_DEVICE_BLOCKED'
  );

  // 4. Student initiates device replacement challenge for mobile replacement
  const replacementReq = await manager.requestDeviceReplacement(studentId, {
    targetDeviceId: 'phone-iphone-16-pro',
    targetDeviceType: 'mobile'
  });
  assert.ok(replacementReq.challengeId);
  assert.ok(replacementReq.codeForTest);

  // Adversarial sub-check: 5 wrong attempts lock the challenge
  const fakeReq = await manager.requestDeviceReplacement(studentId, {
    targetDeviceId: 'phone-fake',
    targetDeviceType: 'mobile'
  });
  for (let i = 0; i < 4; i++) {
    await fails(manager.verifyReplacementOtp(fakeReq.challengeId, '00000000'), 'INVALID_OTP');
  }
  await fails(manager.verifyReplacementOtp(fakeReq.challengeId, '00000000'), 'CHALLENGE_LOCKED');
  // Attempting to approve locked challenge rejects
  await fails(manager.approveDeviceReplacement(superAdmin, fakeReq.challengeId), 'INVALID_CHALLENGE_STATE');

  // Verify legitimate OTP
  const verifyRes = await manager.verifyReplacementOtp(replacementReq.challengeId, replacementReq.codeForTest);
  assert.equal(verifyRes.status, 'PENDING_ADMIN_APPROVAL');

  // 5. Adversarial check: Unauthorized roles cannot approve replacement
  await fails(manager.approveDeviceReplacement(salesOfficer, replacementReq.challengeId), 'FORBIDDEN');
  await fails(manager.approveDeviceReplacement(examOfficer, replacementReq.challengeId), 'FORBIDDEN');
  await fails(manager.approveDeviceReplacement(financeOfficer, replacementReq.challengeId), 'FORBIDDEN');

  // Before approval, Phone 1 session is still active
  const portalPhonePreApproval = await access.portal(sessionPhone.token, 'browser-iphone13');
  assert.equal(portalPhonePreApproval.accesses.length, 1);

  // 6. Super Admin approves device replacement
  const approvalRes = await manager.approveDeviceReplacement(superAdmin, replacementReq.challengeId);
  assert.equal(approvalRes.success, true);
  assert.equal(approvalRes.revokedDeviceId, 'phone-iphone-13', 'Old mobile phone must be identified as revoked');
  assert.equal(approvalRes.newDeviceId, 'phone-iphone-16-pro', 'New mobile phone must be registered');

  // 7. Verify device state in database:
  // Old phone was replaced and revoked, new phone is active, laptop is retained
  const registeredDevices = await manager.getRegisteredDevices(studentId);
  const oldPhone = registeredDevices.find(d => d.deviceId === 'phone-iphone-13');
  const newPhone = registeredDevices.find(d => d.deviceId === 'phone-iphone-16-pro');
  const existingLaptop = registeredDevices.find(d => d.deviceId === 'laptop-thinkpad-x1');

  assert.equal(oldPhone, undefined, 'Old phone must be removed from active registered device slots');
  assert.ok(newPhone, 'New phone must exist in registered devices');
  assert.equal(newPhone.status, 'ACTIVE', 'New phone status must be ACTIVE');
  assert.ok(existingLaptop, 'Laptop must remain intact in registered devices');
  assert.equal(existingLaptop.status, 'ACTIVE', 'Laptop status must remain ACTIVE');

  const activeDevices = registeredDevices.filter(d => d.status === 'ACTIVE');
  assert.equal(activeDevices.length, 2, 'Exactly 2 active devices must remain (1 mobile + 1 desktop)');

  // 8. Session Revocation: Active session on revoked device MUST BE IMMEDIATELY TERMINATED
  let revokedSessionError = null;
  try {
    await access.portal(sessionPhone.token, 'browser-iphone13');
  } catch (err) {
    revokedSessionError = err;
  }
  assert.ok(revokedSessionError, 'Old session on revoked device must fail');
  assert.equal(revokedSessionError.code, 'SESSION_EXPIRED', 'Old session must fail with SESSION_EXPIRED');
  assert.equal(revokedSessionError.status, 401, 'Status must be HTTP 401');

  // Verify authenticate method also fails
  await store.transaction(async tx => {
    let authError = null;
    try {
      await access.authenticate(tx, sessionPhone.token, 'browser-iphone13');
    } catch (err) {
      authError = err;
    }
    assert.ok(authError);
    assert.equal(authError.code, 'SESSION_EXPIRED');
    assert.equal(authError.status, 401);
  });

  // Replay defense: repeated attempts with old session token consistently fail
  for (let i = 0; i < 3; i++) {
    await fails(access.portal(sessionPhone.token, 'browser-iphone13'), 'SESSION_EXPIRED');
  }

  // 9. Replay defense on challenge: cannot approve same challenge twice
  await fails(
    manager.approveDeviceReplacement(superAdmin, replacementReq.challengeId),
    'INVALID_CHALLENGE_STATE'
  );

  // 10. Verify audit event
  const approvalAudit = store.events.find(e => e.action === 'security.device_replacement.approved');
  assert.ok(approvalAudit, 'Audit log must record security.device_replacement.approved');
  assert.equal(approvalAudit.actorId, superAdmin.id);
  assert.equal(approvalAudit.details.revokedDeviceId, 'phone-iphone-13');
  assert.equal(approvalAudit.details.newDeviceId, 'phone-iphone-16-pro');
});
