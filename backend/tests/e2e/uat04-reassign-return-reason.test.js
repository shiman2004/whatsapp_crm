import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamOperations, orderKey } from '../../src/examOperations.js';
import { TestStore, fails } from './fixtures/testHarness.js';
import { salesOfficer, examManager, examOfficer, otherOfficer, financeOfficer, superAdmin } from './fixtures/actors.js';
import { createSalesHandoffInput, createOrderRequirementInput } from './fixtures/payloads.js';

test('UAT 4: Case Reassignment with Mandatory Reason (Happy Path)', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  await ops.updateHandoff(examManager, handoff.id, 'accept', { revision: 1 });
  const assigned = await ops.updateHandoff(examManager, handoff.id, 'assign', {
    revision: 2,
    officerId: examOfficer.id,
    officerName: examOfficer.fullName,
    reason: 'Initial assignment to Officer Ahmed.'
  });

  assert.equal(assigned.status, 'ASSIGNED');
  assert.equal(assigned.assignedOfficerId, examOfficer.id);

  // Reassign to Officer Sara due to workload/leave
  const reassignReason = 'Reassigned due to medical leave of primary officer; priority case.';
  const reassigned = await ops.updateHandoff(examManager, handoff.id, 'assign', {
    revision: 3,
    officerId: otherOfficer.id,
    officerName: otherOfficer.fullName,
    reason: reassignReason
  });

  assert.equal(reassigned.status, 'ASSIGNED');
  assert.equal(reassigned.assignedOfficerId, otherOfficer.id);
  assert.equal(reassigned.assignedOfficerName, otherOfficer.fullName);
  assert.equal(reassigned.revision, 4);

  // History array check
  const historyItem = reassigned.history.find(h => h.reason === reassignReason);
  assert.ok(historyItem, 'Reassignment reason must be immutably recorded in history array');
  assert.equal(historyItem.action, 'assign');
  assert.equal(historyItem.actorId, examManager.id);

  // Audit event check
  const auditEvent = store.events.filter(e => e.action === 'exam.handoff.assign').pop();
  assert.ok(auditEvent);
  assert.equal(auditEvent.details.reason, reassignReason);
  assert.equal(auditEvent.details.assignedOfficerId, otherOfficer.id);
});

test('UAT 4: Return Case to Sales for Missing Information with Mandatory Reason', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const input = createOrderRequirementInput();
  const record = await ops.submit(salesOfficer, input);

  // Manager returns case to Sales for missing information
  const returnReason = 'Client contact number unreachable; sales must verify alternative contact number.';
  const returned = await ops.update(examManager, record.id, 'transition', {
    revision: 1,
    status: 'NEEDS_INFORMATION',
    reason: returnReason
  });

  assert.equal(returned.status, 'NEEDS_INFORMATION');
  assert.equal(returned.history.pop().reason, returnReason);
});

test('UAT 4: Manager Return Order for Correction with Mandatory Reason', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const input = createOrderRequirementInput();
  const record = await ops.submit(salesOfficer, input);

  // 1. Super Admin verifies payment
  await ops.update(superAdmin, record.id, 'verify-payment', { revision: 1, reference: 'TXN-RET-1234' });
  // 2. Manager accepts
  await ops.update(examManager, record.id, 'transition', { revision: 2, status: 'ACCEPTED' });
  // 3. Manager transitions to PREPARING
  await ops.update(examManager, record.id, 'transition', { revision: 3, status: 'PREPARING' });
  // 4. Set preparation checklist
  await ops.update(examManager, record.id, 'checklist', {
    revision: 4,
    account: true,
    materials: true,
    exams: true,
    quality: true
  });
  // 5. Move to READY then PENDING_MANAGER_APPROVAL
  await ops.update(examManager, record.id, 'transition', { revision: 5, status: 'READY' });
  await ops.update(examManager, record.id, 'transition', { revision: 6, status: 'PENDING_MANAGER_APPROVAL' });

  // 6. Manager returns for correction
  const returnReason = 'Need updated DHA 2026 pediatric clinical guidelines appended.';
  const returned = await ops.update(examManager, record.id, 'manager-return', {
    revision: 7,
    reason: returnReason
  });

  assert.equal(returned.status, 'RETURNED_FOR_CORRECTION');
  assert.equal(returned.managerApproval.decision, 'RETURNED');
  assert.equal(returned.managerApproval.comments, returnReason);
  assert.equal(returned.managerApproval.managerId, examManager.id);
});

test('UAT 4: Negative Path — Return rejected when mandatory reason is missing or < 3 chars', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const input = createOrderRequirementInput();
  const record = await ops.submit(salesOfficer, input);

  await fails(
    ops.update(examManager, record.id, 'transition', { revision: 1, status: 'NEEDS_INFORMATION', reason: '' }),
    'REASON_REQUIRED'
  );
  await fails(
    ops.update(examManager, record.id, 'transition', { revision: 1, status: 'NEEDS_INFORMATION', reason: 'no' }),
    'REASON_REQUIRED'
  );
});

test('UAT 4: Negative Path — Non-manager cannot execute return', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const input = createOrderRequirementInput();
  const record = await ops.submit(salesOfficer, input);

  await fails(
    ops.update(salesOfficer, record.id, 'transition', {
      revision: 1,
      status: 'NEEDS_INFORMATION',
      reason: 'Sales cannot transition status'
    }),
    'FORBIDDEN'
  );
});
