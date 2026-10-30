import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamOperations } from '../../src/examOperations.js';
import { TestStore, fails } from './fixtures/testHarness.js';
import { salesOfficer, examManager, examOfficer, superAdmin } from './fixtures/actors.js';
import { createSalesHandoffInput } from './fixtures/payloads.js';

test('UAT 2: Exam Manager Case Acceptance & Officer Assignment (Happy Path)', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());

  assert.equal(handoff.status, 'PENDING_ACCEPTANCE');

  // 1. Head of Exam accepts handoff (using initial revision 1)
  const accepted = await ops.updateHandoff(examManager, handoff.id, 'accept', { revision: 1 });
  assert.equal(accepted.status, 'ACCEPTED');
  assert.equal(accepted.acceptedBy, examManager.id);
  assert.ok(accepted.acceptedAt, 'acceptedAt timestamp must be recorded');
  assert.equal(accepted.revision, 2);

  // 2. Head of Exam assigns to Exam Providing Officer
  const assigned = await ops.updateHandoff(examManager, handoff.id, 'assign', {
    revision: 2,
    officerId: examOfficer.id,
    officerName: examOfficer.fullName,
    reason: 'Assigned based on UAE medical licensing specialization.'
  });

  assert.equal(assigned.status, 'ASSIGNED');
  assert.equal(assigned.assignedOfficerId, examOfficer.id);
  assert.equal(assigned.assignedOfficerName, examOfficer.fullName);
  assert.equal(assigned.assignedBy, examManager.id);
  assert.ok(assigned.assignedAt, 'assignedAt timestamp must be recorded');
  assert.equal(assigned.revision, 3);

  // Audit logs verification
  const acceptAudit = store.events.find(e => e.action === 'exam.handoff.accept');
  const assignAudit = store.events.find(e => e.action === 'exam.handoff.assign');
  assert.ok(acceptAudit, 'exam.handoff.accept audit entry must be recorded');
  assert.ok(assignAudit, 'exam.handoff.assign audit entry must be recorded');
  assert.equal(acceptAudit.actorId, examManager.id);
  assert.equal(assignAudit.actorId, examManager.id);
  assert.equal(assignAudit.details.assignedOfficerId, examOfficer.id);
});

test('UAT 2: Negative Path — Non-manager cannot accept handoff', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());

  // Sales Officer attempting to accept handoff
  await fails(ops.updateHandoff(salesOfficer, handoff.id, 'accept', { revision: 1 }), 'FORBIDDEN');
  // Exam Providing Officer attempting to accept handoff
  await fails(ops.updateHandoff(examOfficer, handoff.id, 'accept', { revision: 1 }), 'FORBIDDEN');
});

test('UAT 2: Negative Path — Non-manager cannot assign officer', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  await ops.updateHandoff(examManager, handoff.id, 'accept', { revision: 1 });

  await fails(
    ops.updateHandoff(examOfficer, handoff.id, 'assign', {
      revision: 2,
      officerId: examOfficer.id,
      officerName: examOfficer.fullName
    }),
    'FORBIDDEN'
  );
});

test('UAT 2: Negative Path — Concurrency race with stale revision rejected', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());

  // Pass stale revision 99
  await fails(
    ops.updateHandoff(examManager, handoff.id, 'accept', { revision: 99 }),
    'STALE_RECORD'
  );
});

test('UAT 2: Negative Path — Assigning officer without accepting first is rejected', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());

  // Still in PENDING_ACCEPTANCE; attempting to jump directly to assign
  await fails(
    ops.updateHandoff(examManager, handoff.id, 'assign', {
      revision: 1,
      officerId: examOfficer.id,
      officerName: examOfficer.fullName
    }),
    'INVALID_STATUS'
  );
});

test('UAT 2: Negative Path — Assigning without specifying officer ID or name is rejected', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  await ops.updateHandoff(examManager, handoff.id, 'accept', { revision: 1 });

  await fails(
    ops.updateHandoff(examManager, handoff.id, 'assign', {
      revision: 2,
      officerId: '',
      officerName: ''
    }),
    'OFFICER_REQUIRED'
  );
});
