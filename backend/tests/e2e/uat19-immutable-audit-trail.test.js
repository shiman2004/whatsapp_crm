import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamOperations } from '../../src/examOperations.js';
import { TestStore, fails } from './fixtures/testHarness.js';
import { salesOfficer, examManager, superAdmin } from './fixtures/actors.js';
import { createSalesHandoffInput } from './fixtures/payloads.js';

test('UAT 19: Immutable Audit Logging Across Full Operational Lifecycle (Happy Path)', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);

  // 1. Submit handoff
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  // 2. Accept handoff
  await ops.updateHandoff(examManager, handoff.id, 'accept', { revision: 1 });
  // 3. Assign handoff
  await ops.updateHandoff(examManager, handoff.id, 'assign', {
    revision: 2,
    officerId: 'officer-audit-1',
    officerName: 'Officer Audit Test',
    reason: 'Audited assignment'
  });

  // Verify unbroken sequence in audit trail
  const handoffAudits = store.events.filter(e => e.action.startsWith('exam.handoff.'));
  assert.equal(handoffAudits.length, 3);
  assert.equal(handoffAudits[0].action, 'exam.handoff.forwarded');
  assert.equal(handoffAudits[0].actorId, salesOfficer.id);
  assert.equal(handoffAudits[1].action, 'exam.handoff.accept');
  assert.equal(handoffAudits[1].actorId, examManager.id);
  assert.equal(handoffAudits[2].action, 'exam.handoff.assign');
  assert.equal(handoffAudits[2].actorId, examManager.id);
  assert.equal(handoffAudits[2].details.assignedOfficerId, 'officer-audit-1');

  // Verify timestamps are valid ISO strings
  for (const event of handoffAudits) {
    assert.ok(Number.isFinite(Date.parse(event.at)), 'Audit event must have valid ISO timestamp');
  }
});

test('UAT 19: Database Immutability Trigger — UPDATE on audit tables is rejected', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());

  const auditRows = [...store.rows.entries()].filter(([k]) => k.startsWith('audit:'));
  assert.ok(auditRows.length > 0);
  const [auditKey, auditRecord] = auditRows[0];
  const auditId = auditKey.replace('audit:', '');

  // Attempt to rewrite audit record in place
  await fails(
    store.transaction(async tx => {
      await tx.put('audit', auditId, { ...auditRecord, actorId: 'malicious-hacker' });
    }),
    'Audit log records are immutable and cannot be updated or deleted'
  );
});

test('UAT 19: Database Immutability Trigger — DELETE on audit tables is rejected', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());

  const auditRows = [...store.rows.entries()].filter(([k]) => k.startsWith('audit:'));
  const [auditKey] = auditRows[0];
  const auditId = auditKey.replace('audit:', '');

  // Attempt to delete audit record
  await fails(
    store.transaction(async tx => {
      await tx.delete('audit', auditId);
    }),
    'Audit log records are immutable and cannot be updated or deleted'
  );
});

test('UAT 19: Transaction Rollback Defense — Failed actions roll back audit entries (no phantoms)', async () => {
  const store = new TestStore();
  const ops = new ExamOperations(store);
  const handoff = await ops.submitHandoff(salesOfficer, createSalesHandoffInput());
  const auditCountBefore = store.events.length;

  // Attempt an invalid transition that fails with STALE_RECORD
  try {
    await ops.updateHandoff(examManager, handoff.id, 'accept', { revision: 999 });
  } catch {}

  // No phantom audit events should be retained
  assert.equal(store.events.length, auditCountBefore, 'Failed operations must roll back in-transaction audit logs');
});
