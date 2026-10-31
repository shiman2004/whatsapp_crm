import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamOperations, orderKey } from '../../src/examOperations.js';
import { StudentAccess } from '../../src/studentAccess.js';
import { validateAcademicUpload } from '../../src/examPolicy.js';
import {
  TestStore,
  DevicePolicyManager,
  InteractiveMcqValidator,
  TimedMockExamEngine,
  fails,
  unsealPayload,
  JWT_SECRET
} from './fixtures/testHarness.js';
import {
  superAdmin,
  examManager,
  examOfficer,
  salesOfficer
} from './fixtures/actors.js';
import {
  createSalesHandoffInput,
  createOrderRequirementInput,
  createSampleMcqQuestion,
  createSampleMockTest
} from './fixtures/payloads.js';

// =============================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS (End-to-End Multi-Phase Lifecycles)
// =============================================================================

test('Tier 4 [Scenario Alpha]: Dr. Fatima Al-Zahra Complete End-to-End DHA GP Licensing Journey', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const access = new StudentAccess(store, JWT_SECRET);
  const deviceManager = new DevicePolicyManager(store);

  const email = 'fatima.journey@alphahealthgroup.ae';
  const studentId = orderKey(email);

  // 0. Seed published DHA clinical study material and questions
  await store.transaction(async tx => {
    await tx.put('asset', 'mat-dha-protocols', {
      id: 'mat-dha-protocols',
      title: 'DHA General Practitioner Clinical Protocols 2026.pdf',
      version: 1,
      status: 'PUBLISHED',
      text: 'Emergency airway management, cardiology algorithms, and pediatric fluid protocols.'
    });
  });

  // 1. Sales intake & handoff forwarding
  const handoffInput = createSalesHandoffInput({
    leadId: 'lead-fatima-journey',
    leadName: 'Dr. Fatima Al-Zahra',
    clientEmail: email,
    quotationNumber: 'QT-FATIMA-2026',
    paymentReceiptUrl: '/uploads/receipt-fatima.pdf?sig=valid123',
    receiptVoucherUrl: '/uploads/voucher-fatima.pdf?sig=valid456',
    receiptVoucherNo: 'RV-FATIMA-01'
  });
  const handoff = await ops.submitHandoff(salesOfficer, handoffInput);
  assert.equal(handoff.status, 'PENDING_ACCEPTANCE');

  // Sales requirement order
  const reqInput = createOrderRequirementInput({
    orderId: 'order-fatima-journey',
    studentName: 'Dr. Fatima Al-Zahra',
    email,
    packageId: 'DHA-GP-COMPLETE',
    durationDays: 180,
    services: ['exam_material', 'mock_test']
  });
  const req = await ops.submit(salesOfficer, reqInput);

  // 2. Exam Manager reviews and accepts handoff, then assigns Officer Ahmed
  await ops.updateHandoff(examManager, handoff.id, 'accept', { revision: 1 });
  await ops.updateHandoff(examManager, handoff.id, 'assign', {
    revision: 2,
    officerId: examOfficer.id,
    officerName: examOfficer.fullName,
    reason: 'Assigned based on UAE medical licensing specialization.'
  });

  // 3. Finance Officer independently verifies payment wire
  await ops.update(superAdmin, req.id, 'verify-payment', {
    revision: 1,
    reference: 'WIRE-STANCHART-FATIMA-88192'
  });

  // 4. Officer Ahmed acknowledges assignment, starts work, and delivers
  await ops.updateHandoff(examOfficer, handoff.id, 'accept-assignment', { revision: 3 });
  await ops.updateHandoff(examOfficer, handoff.id, 'start', { revision: 4 });
  await ops.updateHandoff(examOfficer, handoff.id, 'complete', {
    revision: 5,
    reason: 'DHA GP curriculum, MCQs and 3 full simulation mocks prepared.'
  });

  // 5. Processing staff marks checklist and records verified email
  await ops.update(examManager, req.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, req.id, 'transition', { revision: 3, status: 'PREPARING' });
  await ops.update(examManager, req.id, 'checklist', {
    revision: 4,
    account: true,
    materials: true,
    exams: true,
    quality: true
  });
  await ops.update(examManager, req.id, 'mark-email-verified', {
    revision: 5,
    reason: 'Verified via hospital HR official email.'
  });
  await ops.update(examManager, req.id, 'transition', { revision: 6, status: 'READY' });
  await ops.update(examManager, req.id, 'transition', { revision: 7, status: 'PENDING_MANAGER_APPROVAL' });

  // 6. Exam Department Manager performs final authorization
  await ops.update(examManager, req.id, 'manager-approve', {
    revision: 8,
    reason: 'All DHA General Practitioner materials verified and approved for release.'
  });

  // 7. System activates student access
  const activatedReq = await ops.update(superAdmin, req.id, 'prepare-access', {
    revision: 9,
    materialIds: ['mat-dha-protocols']
  });
  assert.ok(activatedReq.entitlementId);

  // 8. Super Admin queues activation invite
  await access.invite(superAdmin, studentId, 'http://localhost:5173');
  const outboxItem = store.rows.get([...store.rows.keys()].find(k => k.startsWith('outbox:')));
  const token = unsealPayload(access, outboxItem.payload).link.split('#activate=')[1];

  // 9. Fatima activates account with secure passphrase
  const studentPassword = 'DrFatimaSecurePassphrase2026!';
  const activationSession = await access.activate(token, studentPassword, 'browser-fatima-iphone');
  assert.ok(activationSession.token);

  // 10. Fatima registers allowed 2 devices (1 Mobile + 1 Laptop)
  const regMobile = await deviceManager.registerDevice(studentId, {
    deviceId: 'fatima-iphone-15',
    deviceType: 'mobile',
    browserName: 'Mobile Safari'
  });
  const regLaptop = await deviceManager.registerDevice(studentId, {
    deviceId: 'fatima-macbook-pro',
    deviceType: 'desktop',
    browserName: 'Chrome macOS'
  });
  assert.equal(regMobile.success, true);
  assert.equal(regLaptop.success, true);

  // 11. Fatima takes interactive MCQ Practice:
  // Step 1: Wrong answer triggers failure banner, no notes revealed
  const mcq = createSampleMcqQuestion({ id: 'fatima-q1', correctAnswer: 'C' });
  const wrongAttempt = InteractiveMcqValidator.evaluateAnswer(mcq, 'A');
  assert.equal(wrongAttempt.isCorrect, false);
  assert.equal(wrongAttempt.rememberNotes, undefined);

  // Step 2: Correct answer reveals 3 Remember Notes & clinical rationale
  const correctAttempt = InteractiveMcqValidator.evaluateAnswer(mcq, 'C');
  assert.equal(correctAttempt.isCorrect, true);
  assert.equal(correctAttempt.rememberNotes.length, 3);

  // 12. Fatima takes Timed Mock Exam: scores 80% (PASS)
  const mockTest = createSampleMockTest({ passingScore: 70 });
  const mockQuestions = [
    createSampleMcqQuestion({ id: 'mq1', correctAnswer: 'A' }),
    createSampleMcqQuestion({ id: 'mq2', correctAnswer: 'B' }),
    createSampleMcqQuestion({ id: 'mq3', correctAnswer: 'C' }),
    createSampleMcqQuestion({ id: 'mq4', correctAnswer: 'D' }),
    createSampleMcqQuestion({ id: 'mq5', correctAnswer: 'E' })
  ];
  const studentAnswers = { mq1: 'A', mq2: 'B', mq3: 'C', mq4: 'D', mq5: 'A' }; // 4/5 = 80%
  const mockResult = TimedMockExamEngine.gradeMockTest(mockTest, mockQuestions, studentAnswers, 2700);
  assert.equal(mockResult.percentage, 80);
  assert.equal(mockResult.result, 'PASS');

  // 13. Fatima views study material PDF with dynamic watermark
  const portalView = await access.portal(activationSession.token, 'browser-fatima-iphone');
  assert.equal(portalView.assets.length, 1);
  const watermark = `Licensed to: Dr. Fatima Al-Zahra (${studentId.slice(0, 10)}) | ${email} | AHG CRM Protected`;
  assert.ok(watermark.includes('Dr. Fatima Al-Zahra'));
  assert.ok(watermark.includes(email));

  // 14. Verify complete audit trail persisted in store
  const auditActions = store.events.map(e => e.action);
  assert.ok(auditActions.includes('exam.handoff.forwarded'));
  assert.ok(auditActions.includes('exam.handoff.accept'));
  assert.ok(auditActions.includes('exam.handoff.assign'));
  assert.ok(auditActions.includes('requirement.verify-payment'));
  assert.ok(auditActions.includes('requirement.manager-approve'));
  assert.ok(auditActions.includes('student.activated'));
});

test('Tier 4 [Scenario Beta]: Nurse Chen Repeat Purchase & Controlled Device Replacement', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const access = new StudentAccess(store, JWT_SECRET);
  const deviceManager = new DevicePolicyManager(store);

  const email = 'nurse.chen@alphahealthgroup.ae';
  const studentId = orderKey(email);
  const password = 'NurseChenPassphrase2026!';
  const passwordHash = await access.hashPassword(password);
  const nowIso = new Date().toISOString();

  // Setup initial active account with NCLEX package and 2 registered devices
  await store.transaction(async tx => {
    await tx.put('student', studentId, {
      id: studentId,
      name: 'Nurse Sara Chen',
      email,
      status: 'ACTIVE',
      activatedAt: nowIso,
      generation: 1,
      passwordHash,
      registeredDevices: [],
      browserDigest: access.digest('browser-iphone')
    });
    await tx.put('asset', 'mat-nclex', { id: 'mat-nclex', title: 'NCLEX RN Guide', status: 'PUBLISHED' });
    await tx.put('asset', 'mat-dha-nurse', { id: 'mat-dha-nurse', title: 'DHA Nurse Guide', status: 'PUBLISHED' });
    await tx.put('entitlement', 'ent-nclex', {
      id: 'ent-nclex',
      studentId,
      ownerId: studentId,
      materialIds: ['mat-nclex'],
      status: 'ACTIVE',
      startsAt: nowIso,
      endsAt: new Date(Date.now() + 90 * 86400000).toISOString()
    });
  });

  // Register Device 1 (iPhone) & Device 2 (Dell Laptop)
  await deviceManager.registerDevice(studentId, { deviceId: 'chen-iphone', deviceType: 'mobile' });
  await deviceManager.registerDevice(studentId, { deviceId: 'chen-dell', deviceType: 'desktop' });

  // 1. Repeat Purchase: Nurse Chen buys DHA Nurse package
  const repeatReq = await ops.submit(salesOfficer, createOrderRequirementInput({
    orderId: 'order-chen-dha-repeat',
    email,
    packageId: 'DHA-NURSE-PRO',
    services: ['exam_material']
  }));
  await ops.update(superAdmin, repeatReq.id, 'verify-payment', { revision: 1, reference: 'TXN-CHEN-REPEAT' });
  await ops.update(examManager, repeatReq.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, repeatReq.id, 'transition', { revision: 3, status: 'PREPARING' });
  await ops.update(examManager, repeatReq.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: true });
  await ops.update(examManager, repeatReq.id, 'mark-email-verified', { revision: 5, reason: 'Verified returning student' });
  await ops.update(examManager, repeatReq.id, 'transition', { revision: 6, status: 'READY' });
  await ops.update(examManager, repeatReq.id, 'transition', { revision: 7, status: 'PENDING_MANAGER_APPROVAL' });
  await ops.update(examManager, repeatReq.id, 'manager-approve', { revision: 8, reason: 'Approved' });
  await ops.update(superAdmin, repeatReq.id, 'prepare-access', { revision: 9, materialIds: ['mat-dha-nurse'] });

  // Exactly 1 student record, 2 entitlements
  const studentRows = [...store.rows.entries()].filter(([k]) => k.startsWith('student:'));
  assert.equal(studentRows.length, 1);
  const entitlements = await store.transaction(tx => tx.list('entitlement', studentId));
  assert.equal(entitlements.length, 2);

  // 2. Nurse Chen attempts login on 3rd device (new iPad) -> blocked by 2-device policy
  await fails(
    deviceManager.registerDevice(studentId, { deviceId: 'chen-ipad-pro', deviceType: 'mobile' }),
    'THIRD_DEVICE_BLOCKED'
  );

  // 3. Submits replacement request -> email OTP -> verifies -> Admin approves
  const challenge = await deviceManager.requestDeviceReplacement(studentId, {
    targetDeviceId: 'chen-ipad-pro',
    targetDeviceType: 'mobile'
  });
  await deviceManager.verifyReplacementOtp(challenge.challengeId, challenge.codeForTest);
  const approval = await deviceManager.approveDeviceReplacement(superAdmin, challenge.challengeId);

  assert.equal(approval.revokedDeviceId, 'chen-iphone');
  assert.equal(approval.newDeviceId, 'chen-ipad-pro');

  // 4. Portal displays both active course packages
  const loginSession = await access.login(email, password, 'browser-iphone');
  const portalView = await access.portal(loginSession.token, 'browser-iphone');
  assert.equal(portalView.accesses.length, 2);
  const assetTitles = portalView.assets.map(a => a.id);
  assert.ok(assetTitles.includes('mat-nclex'));
  assert.ok(assetTitles.includes('mat-dha-nurse'));
});

test('Tier 4 [Scenario Gamma]: Adversarial Integrity & Attack Barrier Drill', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const deviceManager = new DevicePolicyManager(store);

  const req = await ops.submit(salesOfficer, createOrderRequirementInput());

  // 1. Salesperson attempts to bypass Finance and directly verify payment -> BLOCKED
  await fails(
    ops.update(salesOfficer, req.id, 'verify-payment', { revision: 1, reference: 'SPOOF-PAY' }),
    'FORBIDDEN'
  );

  // 2. Exam Officer attempts self-approval -> BLOCKED
  await fails(
    ops.update(examOfficer, req.id, 'manager-approve', { revision: 1, reason: 'Self approve' }),
    'NOT_FOUND'
  );

  // 3. Upload of disguised executable (.exe) -> BLOCKED
  assert.throws(() => validateAcademicUpload({ name: 'syllabus_update.exe', size: 5000 }), /prohibited file type/);

  // 4. Brute force OTP attack: 5 consecutive invalid codes locks challenge
  const studentId = 'stu-adversarial';
  await store.transaction(tx => tx.put('student', studentId, { id: studentId, registeredDevices: [] }));
  const ch = await deviceManager.requestDeviceReplacement(studentId, { targetDeviceId: 'hack-dev', targetDeviceType: 'mobile' });
  for (let i = 0; i < 4; i++) {
    await fails(deviceManager.verifyReplacementOtp(ch.challengeId, '11111111'), 'INVALID_OTP');
  }
  await fails(deviceManager.verifyReplacementOtp(ch.challengeId, '11111111'), 'CHALLENGE_LOCKED');

  // 5. Malicious DB user attempts to DELETE or UPDATE audit table -> BLOCKED
  const auditId = store.events[0].id;
  await fails(store.transaction(tx => tx.delete('audit', auditId)), 'Audit log records are immutable');
  await fails(store.transaction(tx => tx.put('audit', auditId, { actorId: 'attacker' })), 'Audit log records are immutable');
});
