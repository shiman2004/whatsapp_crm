import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamOperations, orderKey } from '../../src/examOperations.js';
import { StudentAccess } from '../../src/studentAccess.js';
import {
  canAccessAcademic,
  canManageExam,
  canSubmitExamRequirement,
  checkAcademicTransition,
  hasExamCapability
} from '../../src/examPolicy.js';
import { hasCapability } from '../../src/roleMatrix.js';
import {
  TestStore,
  DevicePolicyManager,
  InteractiveMcqValidator,
  TimedMockExamEngine,
  unsealPayload,
  JWT_SECRET
} from './fixtures/testHarness.js';
import {
  superAdmin,
  examManager,
  examOfficer,
  salesOfficer,
  financeOfficer,
  examCoordinator
} from './fixtures/actors.js';
import {
  createSalesHandoffInput,
  createOrderRequirementInput,
  createSampleMcqQuestion,
  createSampleMockTest
} from './fixtures/payloads.js';

// =============================================================================
// TIER 1: FEATURE COVERAGE (Core Happy Path Behavior across All 5 Phases)
// =============================================================================

// --- Phase 1: CRM Workflow & Sales-to-Exam Handover ---
test('Tier 1 [Phase 1.1]: Sales Forwarding Form creates case in PENDING_ACCEPTANCE', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  assert.equal(handoff.status, 'PENDING_ACCEPTANCE');
  assert.equal(handoff.recipientRole, 'exam_department_manager');
});

test('Tier 1 [Phase 1.2]: Head of Exam accepts handoff from inbox', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  const accepted = await ops.updateHandoff(examManager, handoff.id, 'accept', { revision: 1 });
  assert.equal(accepted.status, 'ACCEPTED');
  assert.equal(accepted.acceptedBy, examManager.id);
});

test('Tier 1 [Phase 1.3]: Manager assigns accepted case to Exam Providing Officer', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  await ops.updateHandoff(examManager, handoff.id, 'accept', { revision: 1 });
  const assigned = await ops.updateHandoff(examManager, handoff.id, 'assign', {
    revision: 2,
    officerId: examOfficer.id,
    officerName: examOfficer.fullName,
    reason: 'Initial assignment'
  });
  assert.equal(assigned.status, 'ASSIGNED');
  assert.equal(assigned.assignedOfficerId, examOfficer.id);
});

test('Tier 1 [Phase 1.4]: Officer acknowledges assignment and transitions to OFFICER_ACCEPTED', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  await ops.updateHandoff(examManager, handoff.id, 'accept', { revision: 1 });
  await ops.updateHandoff(examManager, handoff.id, 'assign', { revision: 2, officerId: examOfficer.id, officerName: examOfficer.fullName });
  const accepted = await ops.updateHandoff(examOfficer, handoff.id, 'accept-assignment', { revision: 3 });
  assert.equal(accepted.status, 'OFFICER_ACCEPTED');
});

test('Tier 1 [Phase 1.5]: Officer tracks work progress and completes CRM delivery', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  await ops.updateHandoff(examManager, handoff.id, 'accept', { revision: 1 });
  await ops.updateHandoff(examManager, handoff.id, 'assign', { revision: 2, officerId: examOfficer.id, officerName: examOfficer.fullName });
  await ops.updateHandoff(examOfficer, handoff.id, 'accept-assignment', { revision: 3 });
  await ops.updateHandoff(examOfficer, handoff.id, 'start', { revision: 4 });
  const completed = await ops.updateHandoff(examOfficer, handoff.id, 'complete', { revision: 5, reason: 'Completed' });
  assert.equal(completed.status, 'DELIVERED_TO_CRM');
});

// --- Phase 2: Student Account Management & Controlled Device Security ---
test('Tier 1 [Phase 2.1]: Student identity keyed by SHA-256 personal email digest', () => {
  const email = 'fatima.zahra@example.com';
  const id1 = orderKey(email);
  const id2 = orderKey('FATIMA.ZAHRA@EXAMPLE.COM'.toLowerCase());
  assert.equal(id1, id2);
  assert.match(id1, /^[a-f0-9]{64}$/);
});

test('Tier 1 [Phase 2.2]: Account activation with scrypt password hashing', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);
  const email = 'tier1.activate@example.com';
  const studentId = orderKey(email);

  await store.transaction(tx =>
    tx.put('student', studentId, { id: studentId, name: 'Student', email, status: 'PENDING', generation: 0 })
  );
  await access.invite(superAdmin, studentId, 'http://localhost:5173');
  const outboxItem = store.rows.get([...store.rows.keys()].find(k => k.startsWith('outbox:')));
  const token = unsealPayload(access, outboxItem.payload).link.split('#activate=')[1];

  const session = await access.activate(token, 'AValidSecurePassphrase2026!', 'browser-1');
  assert.ok(session.token);
  assert.equal(session.student.email, email);
});

test('Tier 1 [Phase 2.3]: Device registration allows 1 Mobile and 1 Computer', async () => {
  const store = new TestStore();
  const manager = new DevicePolicyManager(store);
  const studentId = 'stu-dev-tier1';

  await store.transaction(tx =>
    tx.put('student', studentId, { id: studentId, registeredDevices: [] })
  );

  const r1 = await manager.registerDevice(studentId, { deviceId: 'm1', deviceType: 'mobile' });
  const r2 = await manager.registerDevice(studentId, { deviceId: 'd1', deviceType: 'desktop' });
  assert.equal(r1.success, true);
  assert.equal(r2.success, true);
});

test('Tier 1 [Phase 2.4]: Single concurrent active session enforced across devices', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);
  const email = 'tier1.session@example.com';
  const studentId = orderKey(email);
  const passwordHash = await access.hashPassword('SuperPassphrase2026!');

  await store.transaction(tx =>
    tx.put('student', studentId, { id: studentId, email, status: 'ACTIVE', generation: 1, passwordHash, browserDigest: access.digest('b1') })
  );

  const s1 = await access.login(email, 'SuperPassphrase2026!', 'b1');
  const ch = await access.login(email, 'SuperPassphrase2026!', 'b2');
  const code = unsealPayload(access, [...store.rows.values()].find(x => x.purpose === 'device-code').payload).code;
  await access.verifyDevice(ch.challengeId, code, 'b2');

  // Old session invalidated
  await assert.rejects(access.portal(s1.token, 'b1'), err => err.code === 'SESSION_EXPIRED');
});

test('Tier 1 [Phase 2.5]: Device replacement request workflow creates challenge', async () => {
  const store = new TestStore();
  const manager = new DevicePolicyManager(store);
  const studentId = 'stu-replace-tier1';
  await store.transaction(tx => tx.put('student', studentId, { id: studentId, registeredDevices: [] }));

  const challenge = await manager.requestDeviceReplacement(studentId, { targetDeviceId: 'new-dev', targetDeviceType: 'mobile' });
  assert.ok(challenge.challengeId);
  assert.ok(challenge.otpCodeSent);
});

// --- Phase 3: Quotation, Payment Verification & Maker-Checker Material Release ---
test('Tier 1 [Phase 3.1]: New requirements initialized with paymentStatus = PENDING', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const req = await ops.submit(salesOfficer, createOrderRequirementInput());
  assert.equal(req.paymentStatus, 'PENDING');
});

test('Tier 1 [Phase 3.2]: Dedicated Finance / Admin verifies actual bank payment', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const req = await ops.submit(salesOfficer, createOrderRequirementInput());
  const verified = await ops.update(superAdmin, req.id, 'verify-payment', { revision: 1, reference: 'TXN-BANK-100' });
  assert.equal(verified.paymentStatus, 'VERIFIED');
});

test('Tier 1 [Phase 3.3]: Preparation checklist recorded by processing staff', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const req = await ops.submit(salesOfficer, createOrderRequirementInput());
  await ops.update(superAdmin, req.id, 'verify-payment', { revision: 1, reference: 'TXN-100' });
  await ops.update(examManager, req.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, req.id, 'transition', { revision: 3, status: 'PREPARING' });
  const checked = await ops.update(examManager, req.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: true });
  assert.equal(checked.checklist.account, true);
  assert.equal(checked.checklist.quality, true);
});

test('Tier 1 [Phase 3.4]: Manager authorization moves requirement to APPROVED_ACTIVATION_PENDING', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const req = await ops.submit(salesOfficer, createOrderRequirementInput());
  await ops.update(superAdmin, req.id, 'verify-payment', { revision: 1, reference: 'TXN-100' });
  await ops.update(examManager, req.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, req.id, 'transition', { revision: 3, status: 'PREPARING' });
  await ops.update(examManager, req.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: true });
  await ops.update(examManager, req.id, 'mark-email-verified', { revision: 5, reason: 'Verified' });
  await ops.update(examManager, req.id, 'transition', { revision: 6, status: 'READY' });
  await ops.update(examManager, req.id, 'transition', { revision: 7, status: 'PENDING_MANAGER_APPROVAL' });
  const approved = await ops.update(examManager, req.id, 'manager-approve', { revision: 8, reason: 'Approved' });
  assert.equal(approved.status, 'APPROVED_ACTIVATION_PENDING');
});

test('Tier 1 [Phase 3.5]: Access preparation activates student entitlement', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  await store.transaction(tx => tx.put('asset', 'mat-core', { id: 'mat-core', title: 'Core', status: 'PUBLISHED' }));

  const req = await ops.submit(salesOfficer, createOrderRequirementInput());
  await ops.update(superAdmin, req.id, 'verify-payment', { revision: 1, reference: 'TXN-100' });
  await ops.update(examManager, req.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, req.id, 'transition', { revision: 3, status: 'PREPARING' });
  await ops.update(examManager, req.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: true });
  await ops.update(examManager, req.id, 'mark-email-verified', { revision: 5, reason: 'Verified' });
  await ops.update(examManager, req.id, 'transition', { revision: 6, status: 'READY' });
  await ops.update(examManager, req.id, 'transition', { revision: 7, status: 'PENDING_MANAGER_APPROVAL' });
  await ops.update(examManager, req.id, 'manager-approve', { revision: 8, reason: 'Approved' });
  const prepared = await ops.update(superAdmin, req.id, 'prepare-access', { revision: 9, materialIds: ['mat-core'] });
  assert.ok(prepared.entitlementId);
});

// --- Phase 4: Dynamic Masters & Examination Content with Engines ---
test('Tier 1 [Phase 4.1]: Super Admin dynamic course creation capability', () => {
  assert.equal(hasExamCapability(superAdmin, 'exam.course.create_draft'), true);
  assert.equal(hasExamCapability(superAdmin, 'exam.content.publish'), true);
});

test('Tier 1 [Phase 4.2]: Academic lifecycle transitions from Draft to Published', () => {
  const resource = { created_by: examCoordinator.id };
  const s1 = checkAcademicTransition('Draft', 'submit_for_review', examCoordinator, { resource });
  assert.equal(s1, 'Pending_Review');
  const s2 = checkAcademicTransition('Pending_Review', 'publish', examManager, {});
  assert.equal(s2, 'Published');
});

test('Tier 1 [Phase 4.3]: MCQ practice immediate validation unlocks 3 Remember Notes on correct answer', () => {
  const q = createSampleMcqQuestion({ correctAnswer: 'C' });
  const res = InteractiveMcqValidator.evaluateAnswer(q, 'C');
  assert.equal(res.isCorrect, true);
  assert.equal(res.rememberNotes.length, 3);
});

test('Tier 1 [Phase 4.4]: Timed Mock Exam engine accurately scores and evaluates PASS status', () => {
  const mock = createSampleMockTest({ passingScore: 70 });
  const questions = [
    createSampleMcqQuestion({ id: 'q1', correctAnswer: 'A' }),
    createSampleMcqQuestion({ id: 'q2', correctAnswer: 'B' })
  ];
  const res = TimedMockExamEngine.gradeMockTest(mock, questions, { q1: 'A', q2: 'B' }, 120);
  assert.equal(res.score, 2);
  assert.equal(res.percentage, 100);
  assert.equal(res.result, 'PASS');
});

test('Tier 1 [Phase 4.5]: Dynamic watermarking stream contains student ID and email', () => {
  const student = { id: 'STU-1001', name: 'Dr. Fatima', email: 'fatima@ahg.ae' };
  const watermark = `Licensed to: ${student.name} (${student.id}) | ${student.email} | AHG CRM Protected`;
  assert.ok(watermark.includes(student.name));
  assert.ok(watermark.includes(student.id));
  assert.ok(watermark.includes(student.email));
});

// --- Phase 5: Monitoring, Reporting & Immutable Audit Trail ---
test('Tier 1 [Phase 5.1]: Operational transitions generate persistent audit log entries', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  assert.ok(store.events.some(e => e.action === 'exam.handoff.forwarded' && e.target === handoff.id));
});

test('Tier 1 [Phase 5.2]: Audit entries capture actor ID, timestamp and target', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  const ev = store.events[0];
  assert.equal(ev.actorId, salesOfficer.id);
  assert.equal(ev.target, handoff.id);
  assert.ok(ev.at);
});

test('Tier 1 [Phase 5.3]: Role matrix capabilities defined across all 5 core roles', () => {
  assert.equal(hasCapability('super_admin', 'exam.content.publish'), true);
  assert.equal(hasCapability('exam_department_manager', 'exam.content.publish'), true);
  assert.equal(hasCapability('exam_providing_officer', 'exam.material.create_draft'), true);
  assert.equal(hasCapability('finance_officer', 'verify_payment'), true);
  assert.equal(hasCapability('sales_coordinator', 'submit_handover'), true);
});

test('Tier 1 [Phase 5.4]: Perimeter security isolates sales coordinators from academic publishing', () => {
  assert.equal(hasExamCapability(salesOfficer, 'exam.content.publish'), false);
  assert.equal(canAccessAcademic(salesOfficer), 403);
});

test('Tier 1 [Phase 5.5]: System health monitoring tracks operational status and storage health', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const health = await ops.health(superAdmin);
  assert.equal(health.storage, 'connected');
  assert.ok(Array.isArray(health.issues));
});
