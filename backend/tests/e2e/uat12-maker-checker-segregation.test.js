import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamOperations } from '../../src/examOperations.js';
import { TestStore, fails } from './fixtures/testHarness.js';
import { salesOfficer, examManager, examOfficer, superAdmin } from './fixtures/actors.js';
import { createOrderRequirementInput } from './fixtures/payloads.js';

test('UAT 12: Maker-Checker Segregation & Self-Approval Prevention (Happy Path)', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const record = await ops.submit(salesOfficer, createOrderRequirementInput());

  // 1. Finance Officer verifies payment
  await ops.update(superAdmin, record.id, 'verify-payment', { revision: 1, reference: 'TXN-MC-01' });

  // 2. Head of Exam accepts and moves to PREPARING
  await ops.update(examManager, record.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, record.id, 'transition', { revision: 3, status: 'PREPARING' });

  // 3. Exam Processing Officer completes 4-point preparation checklist
  await ops.update(examManager, record.id, 'checklist', {
    revision: 4,
    account: true,
    materials: true,
    exams: true,
    quality: true
  });

  // 4. Case moves to READY then PENDING_MANAGER_APPROVAL
  await ops.update(examManager, record.id, 'transition', { revision: 5, status: 'READY' });
  const pending = await ops.update(examManager, record.id, 'transition', { revision: 6, status: 'PENDING_MANAGER_APPROVAL' });
  assert.equal(pending.status, 'PENDING_MANAGER_APPROVAL');

  // 5. Maker-Checker Enforcement: Non-manager actors cannot approve
  // Sales Officer (owner) attempting self-approval is rejected with FORBIDDEN
  await fails(
    ops.update(salesOfficer, record.id, 'manager-approve', {
      revision: 7,
      reason: 'Sales Officer attempting self-approval'
    }),
    'FORBIDDEN'
  );

  // Exam Providing Officer attempting approval is rejected by perimeter isolation
  await fails(
    ops.update(examOfficer, record.id, 'manager-approve', {
      revision: 7,
      reason: 'Exam Officer attempting self-approval'
    }),
    'NOT_FOUND'
  );

  // 6. Order remains strictly in PENDING_MANAGER_APPROVAL awaiting independent authorization
  const currentRecord = await store.transaction(tx => tx.get('requirement', record.id));
  assert.equal(currentRecord.status, 'PENDING_MANAGER_APPROVAL');
  assert.equal(currentRecord.managerApproval, undefined, 'No manager approval should be recorded');
});

test('UAT 12: Negative Path — Incomplete checklist blocks transition to PENDING_MANAGER_APPROVAL', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const record = await ops.submit(salesOfficer, createOrderRequirementInput());
  await ops.update(superAdmin, record.id, 'verify-payment', { revision: 1, reference: 'TXN-MC-02' });
  await ops.update(examManager, record.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, record.id, 'transition', { revision: 3, status: 'PREPARING' });

  // Set only 3 of 4 checklist items (quality is false)
  await ops.update(examManager, record.id, 'checklist', {
    revision: 4,
    account: true,
    materials: true,
    exams: true,
    quality: false
  });

  // Attempting transition to READY fails with CHECKLIST_REQUIRED
  await fails(
    ops.update(examManager, record.id, 'transition', { revision: 5, status: 'READY' }),
    'CHECKLIST_REQUIRED'
  );
});

test('UAT 12: Negative Path — Unverified payment blocks transition even with complete checklist', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const record = await ops.submit(salesOfficer, createOrderRequirementInput());

  // Manager accepts without payment verification
  await ops.update(examManager, record.id, 'transition', { revision: 1, status: 'ACCEPTED' });

  // Attempting transition to PREPARING fails because paymentStatus is PENDING
  await fails(
    ops.update(examManager, record.id, 'transition', { revision: 2, status: 'PREPARING' }),
    'PAYMENT_REQUIRED'
  );
});

test('UAT 12: HARD RBAC — Submitting Officer cannot approve their own release request (403 SELF_APPROVAL_FORBIDDEN)', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const record = await ops.submit(salesOfficer, createOrderRequirementInput());

  // 1. Finance verifies payment
  await ops.update(superAdmin, record.id, 'verify-payment', { revision: 1, reference: 'TXN-MC-SELF-01' });

  // 2. Manager accepts case and moves to PREPARING
  await ops.update(examManager, record.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  await ops.update(examManager, record.id, 'transition', { revision: 3, status: 'PREPARING' });

  // 3. Exam Processing Officer completes 4-point checklist and submits release request
  await ops.update(examManager, record.id, 'checklist', {
    revision: 4,
    account: true,
    materials: true,
    exams: true,
    quality: true
  });
  await ops.update(examManager, record.id, 'mark-email-verified', { revision: 5, reason: 'Verified via student passport copy' });
  await ops.update(examManager, record.id, 'transition', { revision: 6, status: 'READY' });

  // Processing officer submits release request with their officer ID
  const officerId = 'officer-submitting-44';
  const processingOfficer = {
    id: officerId,
    role: 'exam_department_manager', // Even if holding a dual/manager role
    fullName: 'Officer Submitting',
    email: 'officer.submitting@cras.ae'
  };

  const pending = await ops.update(processingOfficer, record.id, 'transition', {
    revision: 7,
    status: 'PENDING_MANAGER_APPROVAL',
    submittedByOfficerId: officerId
  });

  assert.equal(pending.status, 'PENDING_MANAGER_APPROVAL');
  assert.equal(pending.submittedByOfficerId, officerId);

  // 4. HARD RBAC: Submitting officer attempts self-approval -> MUST REJECT WITH SELF_APPROVAL_FORBIDDEN (403)
  await fails(
    ops.update(processingOfficer, record.id, 'manager-approve', {
      revision: 8,
      reason: 'Attempting to self-approve my own submission'
    }),
    'SELF_APPROVAL_FORBIDDEN'
  );

  // 5. Independent Exam Department Manager (different actor ID) authorizes release successfully
  const approved = await ops.update(examManager, record.id, 'manager-approve', {
    revision: 8,
    reason: 'Verified and authorized by independent Head of Exam Department'
  });

  assert.equal(approved.status, 'APPROVED_ACTIVATION_PENDING');
  assert.equal(approved.materialsStatus, 'MATERIALS_RELEASED');
  assert.equal(approved.managerApproval.managerId, examManager.id);
});
