import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamOperations, orderKey } from '../../src/examOperations.js';
import { StudentAccess } from '../../src/studentAccess.js';
import {
  canAccessAcademic,
  checkAcademicTransition,
  hasExamCapability,
  validateAcademicUpload
} from '../../src/examPolicy.js';
import {
  TestStore,
  DevicePolicyManager,
  InteractiveMcqValidator,
  fails,
  JWT_SECRET
} from './fixtures/testHarness.js';
import {
  superAdmin,
  examManager,
  examOfficer,
  otherOfficer,
  salesOfficer
} from './fixtures/actors.js';
import {
  createSalesHandoffInput,
  createOrderRequirementInput,
  createSampleMcqQuestion
} from './fixtures/payloads.js';

// =============================================================================
// TIER 2: BOUNDARY & CORNER CASES (>= 5 Tests per Phase Category)
// =============================================================================

// --- Phase 1 Boundaries ---
test('Tier 2 [Phase 1.1]: Missing or empty paymentReceiptUrl rejected', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  await fails(ops.submitHandoff(salesOfficer, createSalesHandoffInput({ paymentReceiptUrl: '' })), 'PAYMENT_RECEIPT_REQUIRED');
});

test('Tier 2 [Phase 1.2]: Malformed paymentReceiptUrl without /uploads/ prefix rejected', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  await fails(ops.submitHandoff(salesOfficer, createSalesHandoffInput({ paymentReceiptUrl: 'https://evil.com/fake.pdf' })), 'PAYMENT_RECEIPT_REQUIRED');
});

test('Tier 2 [Phase 1.3]: Empty voucher number rejected', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  await fails(ops.submitHandoff(salesOfficer, createSalesHandoffInput({ receiptVoucherNo: '' })), 'RECEIPT_VOUCHER_REQUIRED');
});

test('Tier 2 [Phase 1.4]: Outdated revision on handoff acceptance rejected with STALE_RECORD', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  await fails(ops.updateHandoff(examManager, handoff.id, 'accept', { revision: 999 }), 'STALE_RECORD');
});

test('Tier 2 [Phase 1.5]: Reassigning without officer specification rejected', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  await ops.updateHandoff(examManager, handoff.id, 'accept', { revision: 1 });
  await fails(ops.updateHandoff(examManager, handoff.id, 'assign', { revision: 2, officerId: '', officerName: '' }), 'OFFICER_REQUIRED');
});

// --- Phase 2 Boundaries ---
test('Tier 2 [Phase 2.1]: Password shorter than 15 characters rejected by policy', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);
  await fails(access.hashPassword('Only14Chars!!'), 'PASSWORD_POLICY');
});

test('Tier 2 [Phase 2.2]: Repeated single-character password rejected by entropy check', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);
  await fails(access.hashPassword('zzzzzzzzzzzzzzzz'), 'PASSWORD_POLICY');
});

test('Tier 2 [Phase 2.3]: Attempt to register second mobile device rejected with DEVICE_LIMIT_EXCEEDED', async () => {
  const store = new TestStore();
  const manager = new DevicePolicyManager(store);
  const studentId = 'stu-t2-mob';
  await store.transaction(tx => tx.put('student', studentId, { id: studentId, registeredDevices: [] }));

  await manager.registerDevice(studentId, { deviceId: 'm1', deviceType: 'mobile' });
  await fails(manager.registerDevice(studentId, { deviceId: 'm2', deviceType: 'mobile' }), 'DEVICE_LIMIT_EXCEEDED');
});

test('Tier 2 [Phase 2.4]: Attempt to register second computer rejected with DEVICE_LIMIT_EXCEEDED', async () => {
  const store = new TestStore();
  const manager = new DevicePolicyManager(store);
  const studentId = 'stu-t2-pc';
  await store.transaction(tx => tx.put('student', studentId, { id: studentId, registeredDevices: [] }));

  await manager.registerDevice(studentId, { deviceId: 'pc1', deviceType: 'desktop' });
  await fails(manager.registerDevice(studentId, { deviceId: 'pc2', deviceType: 'desktop' }), 'DEVICE_LIMIT_EXCEEDED');
});

test('Tier 2 [Phase 2.5]: 5 invalid OTP verification codes trigger challenge lockout', async () => {
  const store = new TestStore();
  const manager = new DevicePolicyManager(store);
  const studentId = 'stu-t2-otp';
  await store.transaction(tx => tx.put('student', studentId, { id: studentId, registeredDevices: [] }));

  const challenge = await manager.requestDeviceReplacement(studentId, { targetDeviceId: 'new-dev', targetDeviceType: 'desktop' });
  for (let i = 0; i < 4; i++) {
    await fails(manager.verifyReplacementOtp(challenge.challengeId, '00000000'), 'INVALID_OTP');
  }
  // 5th attempt locks
  await fails(manager.verifyReplacementOtp(challenge.challengeId, '00000000'), 'CHALLENGE_LOCKED');
});

// --- Phase 3 Boundaries ---
test('Tier 2 [Phase 3.1]: Material release while payment is PENDING is strictly blocked', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const req = await ops.submit(salesOfficer, createOrderRequirementInput());
  await ops.update(examManager, req.id, 'transition', { revision: 1, status: 'ACCEPTED' });
  await fails(ops.update(examManager, req.id, 'transition', { revision: 2, status: 'PREPARING' }), 'PAYMENT_REQUIRED');
});

test('Tier 2 [Phase 3.2]: Transition to READY blocked when checklist item quality is false', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const req = await ops.submit(salesOfficer, createOrderRequirementInput());
  await ops.update(superAdmin, req.id, 'verify-payment', { revision: 1, reference: 'TXN-T2-01' });
  await ops.update(examManager, req.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, req.id, 'transition', { revision: 3, status: 'PREPARING' });
  await ops.update(examManager, req.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: false });
  await fails(ops.update(examManager, req.id, 'transition', { revision: 5, status: 'READY' }), 'CHECKLIST_REQUIRED');
});

test('Tier 2 [Phase 3.3]: Non-admin sales officer cannot self-approve order', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const req = await ops.submit(salesOfficer, createOrderRequirementInput());
  await fails(ops.update(salesOfficer, req.id, 'manager-approve', { revision: 1, reason: 'Self' }), 'FORBIDDEN');
});

test('Tier 2 [Phase 3.4]: Payment verification reference under 3 characters rejected', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const req = await ops.submit(salesOfficer, createOrderRequirementInput());
  await fails(ops.update(superAdmin, req.id, 'verify-payment', { revision: 1, reference: 'AB' }), 'REFERENCE_REQUIRED');
});

test('Tier 2 [Phase 3.5]: Repeating prepare-access on same requirement rejected with ACCESS_EXISTS', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  await store.transaction(tx => tx.put('asset', 'mat-core-t2', { id: 'mat-core-t2', title: 'T2 Asset', status: 'PUBLISHED' }));

  const req = await ops.submit(salesOfficer, createOrderRequirementInput());
  await ops.update(superAdmin, req.id, 'verify-payment', { revision: 1, reference: 'TXN-T2-02' });
  await ops.update(examManager, req.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, req.id, 'transition', { revision: 3, status: 'PREPARING' });
  await ops.update(examManager, req.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: true });
  await ops.update(examManager, req.id, 'mark-email-verified', { revision: 5, reason: 'Verified' });
  await ops.update(examManager, req.id, 'transition', { revision: 6, status: 'READY' });
  await ops.update(examManager, req.id, 'transition', { revision: 7, status: 'PENDING_MANAGER_APPROVAL' });
  await ops.update(examManager, req.id, 'manager-approve', { revision: 8, reason: 'Approved' });
  await ops.update(superAdmin, req.id, 'prepare-access', { revision: 9, materialIds: ['mat-core-t2'] });

  // Repeat call
  await fails(ops.update(superAdmin, req.id, 'prepare-access', { revision: 10, materialIds: ['mat-core-t2'] }), 'ACCESS_EXISTS');
});

// --- Phase 4 Boundaries ---
test('Tier 2 [Phase 4.1]: Prohibited executable upload (.exe) rejected by security barrier', () => {
  assert.throws(() => validateAcademicUpload({ name: 'trojan.exe', size: 1024 }), /prohibited file type/);
});

test('Tier 2 [Phase 4.2]: Prohibited shell script upload (.sh) rejected by security barrier', () => {
  assert.throws(() => validateAcademicUpload({ name: 'script.sh', size: 1024 }), /prohibited file type/);
});

test('Tier 2 [Phase 4.3]: Upload exceeding 25MB maximum size limit rejected', () => {
  assert.throws(() => validateAcademicUpload({ name: 'giant_video.pdf', size: 26 * 1024 * 1024 }), /exceeds 25MB maximum allowed size/);
});

test('Tier 2 [Phase 4.4]: Author cannot edit another officer unpublished draft', () => {
  const otherDraft = { id: 'd2', created_by: otherOfficer.id, status: 'DRAFT' };
  assert.equal(hasExamCapability(examOfficer, 'exam.draft.edit_own', otherDraft), false);
});

test('Tier 2 [Phase 4.5]: Author cannot self-publish content', () => {
  const myDraft = { id: 'd1', created_by: examOfficer.id, status: 'Pending_Review' };
  assert.throws(
    () => checkAcademicTransition('Pending_Review', 'publish', examOfficer, { resource: myDraft }),
    err => err.status === 403
  );
});

// --- Phase 5 Boundaries ---
test('Tier 2 [Phase 5.1]: Database trigger rejects UPDATE statement on audit log', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  const auditId = store.events[0].id;
  await fails(
    store.transaction(tx => tx.put('audit', auditId, { actorId: 'hacker' })),
    'Audit log records are immutable'
  );
});

test('Tier 2 [Phase 5.2]: Database trigger rejects DELETE statement on audit log', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  const auditId = store.events[0].id;
  await fails(
    store.transaction(tx => tx.delete('audit', auditId)),
    'Audit log records are immutable'
  );
});

test('Tier 2 [Phase 5.3]: Expired entitlement hides study materials from student portal', async () => {
  const store = new TestStore();
  const access = new StudentAccess(store, JWT_SECRET);
  const email = 'tier2.expired@example.com';
  const studentId = orderKey(email);
  const passwordHash = await access.hashPassword('SuperPassphrase2026!');

  await store.transaction(async tx => {
    await tx.put('student', studentId, { id: studentId, email, status: 'ACTIVE', generation: 1, passwordHash, browserDigest: access.digest('b1') });
    await tx.put('asset', 'mat-exp', { id: 'mat-exp', title: 'Old Guide', status: 'PUBLISHED' });
    await tx.put('entitlement', 'ent-exp', {
      id: 'ent-exp',
      studentId,
      ownerId: studentId,
      materialIds: ['mat-exp'],
      status: 'ACTIVE',
      startsAt: '2021-01-01T00:00:00.000Z',
      endsAt: '2021-02-01T00:00:00.000Z'
    });
  });

  const session = await access.login(email, 'SuperPassphrase2026!', 'b1');
  const portal = await access.portal(session.token, 'b1');
  assert.equal(portal.accesses.length, 0);
  assert.equal(portal.assets.length, 0);
});

test('Tier 2 [Phase 5.4]: Non-exam role clinical nurse denied from academic access', () => {
  assert.equal(canAccessAcademic({ id: 'nurse-1', role: 'clinical_nurse' }), 403);
});

test('Tier 2 [Phase 5.5]: Sales Coordinator B cannot read Sales Coordinator A records', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const reqA = await ops.submit(salesOfficer, createOrderRequirementInput());

  const otherSales = { id: 'sales-b', role: 'coordinator', company: 'CRAS' };
  const listB = await ops.list(otherSales);
  assert.equal(listB.length, 0, 'Sales Officer B must see 0 of Sales Officer A records');
});
