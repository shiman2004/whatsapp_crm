import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamOperations, orderKey } from '../../src/examOperations.js';
import { StudentAccess } from '../../src/studentAccess.js';
import { TestStore, fails, JWT_SECRET } from './fixtures/testHarness.js';
import { salesOfficer, examManager, superAdmin } from './fixtures/actors.js';
import { createOrderRequirementInput } from './fixtures/payloads.js';

test('UAT 13: Final Manager Release Approval & Idempotent Portal Activation (Happy Path)', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const access = new StudentAccess(store, JWT_SECRET);
  const email = 'fatima.approval@example.com';
  const studentId = orderKey(email);

  // Setup published material assets in store
  await store.transaction(async tx => {
    await tx.put('asset', 'mat-dha-core', { id: 'mat-dha-core', title: 'DHA Core Syllabus', status: 'PUBLISHED' });
    await tx.put('asset', 'mat-dha-qbank', { id: 'mat-dha-qbank', title: 'DHA Clinical Question Bank', status: 'PUBLISHED' });
  });

  const record = await ops.submit(salesOfficer, createOrderRequirementInput({ email }));

  // 1. Finance verifies payment
  await ops.update(superAdmin, record.id, 'verify-payment', { revision: 1, reference: 'TXN-FATIMA-RELEASE' });

  // 2. Manager accepts, starts preparation, and records checklist + email verification
  await ops.update(examManager, record.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, record.id, 'transition', { revision: 3, status: 'PREPARING' });
  await ops.update(examManager, record.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: true });
  await ops.update(examManager, record.id, 'mark-email-verified', { revision: 5, reason: 'Verified via hospital HR' });
  await ops.update(examManager, record.id, 'transition', { revision: 6, status: 'READY' });
  await ops.update(examManager, record.id, 'transition', { revision: 7, status: 'PENDING_MANAGER_APPROVAL' });

  // 3. Exam Department Manager executes final approval
  const approved = await ops.update(examManager, record.id, 'manager-approve', {
    revision: 8,
    reason: 'All DHA syllabus materials, clinical MCQs and mock exams verified for release.'
  });

  assert.equal(approved.status, 'APPROVED_ACTIVATION_PENDING');
  assert.equal(approved.managerApproval.decision, 'APPROVED');
  assert.equal(approved.managerApproval.managerId, examManager.id);
  assert.ok(approved.managerApproval.decidedAt);

  // 4. System prepares access / activates entitlement
  const prepared = await ops.update(superAdmin, record.id, 'prepare-access', {
    revision: 9,
    materialIds: ['mat-dha-core', 'mat-dha-qbank']
  });

  assert.ok(prepared.entitlementId, 'Entitlement ID must be assigned to requirement');
  assert.equal(prepared.studentId, studentId);

  // 5. Verify entitlement row in store
  const entitlement = await store.transaction(tx => tx.get('entitlement', prepared.entitlementId));
  assert.equal(entitlement.status, 'ACTIVE');
  assert.equal(entitlement.studentId, studentId);
  assert.deepEqual(entitlement.materialIds, ['mat-dha-core', 'mat-dha-qbank']);

  // 6. Repeating prepare-access rejected with 409 ACCESS_EXISTS (idempotent duplicate prevention)
  await fails(
    ops.update(superAdmin, record.id, 'prepare-access', { revision: 10, materialIds: ['mat-dha-core'] }),
    'ACCESS_EXISTS'
  );
});

test('UAT 13: Negative Path — Approval blocked if student email verification is missing', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const record = await ops.submit(salesOfficer, createOrderRequirementInput());

  await ops.update(superAdmin, record.id, 'verify-payment', { revision: 1, reference: 'TXN-NO-EMAIL' });
  await ops.update(examManager, record.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, record.id, 'transition', { revision: 3, status: 'PREPARING' });
  await ops.update(examManager, record.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: true });
  // Omit mark-email-verified
  await ops.update(examManager, record.id, 'transition', { revision: 5, status: 'READY' });
  await ops.update(examManager, record.id, 'transition', { revision: 6, status: 'PENDING_MANAGER_APPROVAL' });

  await fails(
    ops.update(examManager, record.id, 'manager-approve', { revision: 7, reason: 'Approved' }),
    'EMAIL_NOT_VERIFIED'
  );
});

test('UAT 13: Negative Path — prepare-access blocked if material is in DRAFT or unpublished', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  // Store unpublished draft asset
  await store.transaction(tx =>
    tx.put('asset', 'mat-draft-item', { id: 'mat-draft-item', title: 'Draft Notes', status: 'DRAFT' })
  );

  const record = await ops.submit(salesOfficer, createOrderRequirementInput());
  await ops.update(superAdmin, record.id, 'verify-payment', { revision: 1, reference: 'TXN-DRAFT-ASSET' });
  await ops.update(examManager, record.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, record.id, 'transition', { revision: 3, status: 'PREPARING' });
  await ops.update(examManager, record.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: true });
  await ops.update(examManager, record.id, 'mark-email-verified', { revision: 5, reason: 'Verified' });
  await ops.update(examManager, record.id, 'transition', { revision: 6, status: 'READY' });
  await ops.update(examManager, record.id, 'transition', { revision: 7, status: 'PENDING_MANAGER_APPROVAL' });
  await ops.update(examManager, record.id, 'manager-approve', { revision: 8, reason: 'Approved' });

  // Attempt to assign draft asset
  await fails(
    ops.update(superAdmin, record.id, 'prepare-access', { revision: 9, materialIds: ['mat-draft-item'] }),
    'ASSET_NOT_PUBLISHED'
  );
});

test('UAT 13: Idempotent duplicate manager-approve and portal materials release', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  await store.transaction(async tx => {
    await tx.put('asset', 'mat-dha-core-2', { id: 'mat-dha-core-2', title: 'DHA Core Syllabus 2', status: 'PUBLISHED' });
  });

  const record = await ops.submit(salesOfficer, createOrderRequirementInput({ email: 'idemp.student@example.com' }));
  await ops.update(superAdmin, record.id, 'verify-payment', { revision: 1, reference: 'TXN-IDEMP-APPROVE' });
  await ops.update(examManager, record.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, record.id, 'transition', { revision: 3, status: 'PREPARING' });
  await ops.update(examManager, record.id, 'checklist', { revision: 4, account: true, materials: true, exams: true, quality: true });
  await ops.update(examManager, record.id, 'mark-email-verified', { revision: 5, reason: 'Verified via hospital' });
  await ops.update(examManager, record.id, 'transition', { revision: 6, status: 'READY' });
  await ops.update(examManager, record.id, 'transition', { revision: 7, status: 'PENDING_MANAGER_APPROVAL' });

  // First approval
  const approved = await ops.update(examManager, record.id, 'manager-approve', {
    revision: 8,
    reason: 'First approval'
  });
  assert.equal(approved.status, 'APPROVED_ACTIVATION_PENDING');
  assert.equal(approved.materialsStatus, 'MATERIALS_RELEASED');

  // Duplicate approval call returns existing approval idempotently without throwing error
  const dupApproved = await ops.update(examManager, record.id, 'manager-approve', {
    revision: 9,
    reason: 'Duplicate retry approval'
  });
  assert.equal(dupApproved.status, 'APPROVED_ACTIVATION_PENDING');
  assert.equal(dupApproved.materialsStatus, 'MATERIALS_RELEASED');
  assert.ok(dupApproved.duplicate, 'Duplicate flag should be set on idempotent repeat');
});
