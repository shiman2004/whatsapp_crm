import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamOperations } from '../../src/examOperations.js';
import { TestStore, fails } from './fixtures/testHarness.js';
import { salesOfficer, examManager, examOfficer, otherOfficer } from './fixtures/actors.js';
import { createSalesHandoffInput } from './fixtures/payloads.js';

async function setupAssignedHandoff() {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  await ops.updateHandoff(examManager, handoff.id, 'accept', { revision: 1 });
  const assigned = await ops.updateHandoff(examManager, handoff.id, 'assign', {
    revision: 2,
    officerId: examOfficer.id,
    officerName: examOfficer.fullName,
    reason: 'Assigned for DHA General Practitioner preparation.'
  });
  return { store, ops, handoff: assigned };
}

test('UAT 3: Officer Requirement Acceptance, Work Tracking & Delivery (Happy Path)', async () => {
  const { store, ops, handoff } = await setupAssignedHandoff();
  assert.equal(handoff.status, 'ASSIGNED');
  assert.equal(handoff.revision, 3);

  // 1. Assigned officer acknowledges assignment
  const accepted = await ops.updateHandoff(examOfficer, handoff.id, 'accept-assignment', { revision: 3 });
  assert.equal(accepted.status, 'OFFICER_ACCEPTED');
  assert.equal(accepted.officerAcceptedBy, examOfficer.id);
  assert.ok(accepted.officerAcceptedAt, 'officerAcceptedAt must be recorded');
  assert.equal(accepted.revision, 4);

  // 2. Assigned officer starts preparation
  const started = await ops.updateHandoff(examOfficer, handoff.id, 'start', { revision: 4 });
  assert.equal(started.status, 'IN_PROGRESS');
  assert.ok(started.startedAt, 'startedAt must be recorded');
  assert.equal(started.revision, 5);

  // 3. Assigned officer completes delivery back to CRM
  const deliveryReason = 'Complete DHA General Practitioner syllabus and 3 mock exam bundles prepared.';
  const completed = await ops.updateHandoff(examOfficer, handoff.id, 'complete', {
    revision: 5,
    reason: deliveryReason
  });
  assert.equal(completed.status, 'DELIVERED_TO_CRM');
  assert.ok(completed.completedAt, 'completedAt must be recorded');
  assert.equal(completed.completionNote, deliveryReason);
  assert.equal(completed.revision, 6);

  // Audit trails
  assert.ok(store.events.some(e => e.action === 'exam.handoff.accept-assignment'));
  assert.ok(store.events.some(e => e.action === 'exam.handoff.start'));
  assert.ok(store.events.some(e => e.action === 'exam.handoff.complete'));
});

test('UAT 3: Negative Path — Unassigned officer cannot accept or progress another officer case', async () => {
  const { ops, handoff } = await setupAssignedHandoff();

  // otherOfficer (Sara) attempts to accept officer-ahmed's assignment
  await fails(
    ops.updateHandoff(otherOfficer, handoff.id, 'accept-assignment', { revision: 3 }),
    'ASSIGNMENT_REQUIRED'
  );
});

test('UAT 3: Negative Path — Manager cannot perform officer acceptance', async () => {
  const { ops, handoff } = await setupAssignedHandoff();

  // Manager is not an officer and cannot accept the assignment
  await fails(
    ops.updateHandoff(examManager, handoff.id, 'accept-assignment', { revision: 3 }),
    'FORBIDDEN'
  );
});

test('UAT 3: Negative Path — Officer cannot start before accepting assignment', async () => {
  const { ops, handoff } = await setupAssignedHandoff();

  // Attempting start directly from ASSIGNED status
  await fails(
    ops.updateHandoff(examOfficer, handoff.id, 'start', { revision: 3 }),
    'ASSIGNMENT_REQUIRED'
  );
});

test('UAT 3: Negative Path — Officer cannot complete without starting work first', async () => {
  const { ops, handoff } = await setupAssignedHandoff();
  await ops.updateHandoff(examOfficer, handoff.id, 'accept-assignment', { revision: 3 });

  // Attempting complete directly from OFFICER_ACCEPTED without moving to IN_PROGRESS
  await fails(
    ops.updateHandoff(examOfficer, handoff.id, 'complete', {
      revision: 4,
      reason: 'Trying to skip in-progress step.'
    }),
    'ASSIGNMENT_REQUIRED'
  );
});
